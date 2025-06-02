import * as cdk from 'aws-cdk-lib';
import {aws_cognito as cognito} from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_lambda as lambda} from 'aws-cdk-lib';
import {aws_lambda_nodejs as nodejs} from 'aws-cdk-lib';
import {aws_logs as logs} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import { UserGroup } from '@health-command-center/types'; 

/**
 * Authentication Stack for Health Command Center
 * 
 * This stack sets up the complete authentication infrastructure using AWS Cognito.
 * It provides user registration, login, password recovery, and role-based access control.
 * 
 * @class AuthStack
 * @extends {cdk.Stack}
 * 
 * Features:
 * - Email-based authentication (no username required)
 * - Self-service sign-up with email verification
 * - Strong password policy enforcement
 * - Two user groups: Regular Users and Admin Users
 * - Custom email templates via Lambda triggers
 * - CloudWatch logging for debugging
 * 
 * AWS Services Used:
 * - Amazon Cognito: User authentication and authorization
 * - AWS Lambda: Custom message formatting
 * - IAM: Role-based access control
 * - CloudWatch Logs: Debugging and monitoring
 * 
 * Cost Considerations:
 * - Cognito: First 50,000 MAUs free, then $0.0055/MAU
 * - Lambda: First 1M requests/month free
 * - CloudWatch Logs: $0.50/GB ingested, $0.03/GB stored
 * - Total estimated cost for <50k users: <$5/month
 * 
 * Security Features:
 * - Email verification required
 * - Strong password policy (8+ chars, mixed case, numbers, symbols)
 * - Account lockout after failed attempts (via advanced security)
 * - Prevents user enumeration attacks
 * - Token expiration and refresh management
 */
export class AuthStack extends cdk.Stack {
  /**
   * The Cognito User Pool - central authentication service
   * Other stacks can reference this to add authentication to their resources
   */
  public readonly userPool: cognito.UserPool;
  
  /**
   * The User Pool Client - used by the frontend application
   * Contains settings for how the app can interact with Cognito
   */
  public readonly userPoolClient: cognito.UserPoolClient;
  
  /**
   * User group for regular users with standard permissions
   */
  public readonly regularUsersGroup: cognito.CfnUserPoolGroup;
  
  /**
   * User group for administrators with elevated permissions
   */
  public readonly adminUsersGroup: cognito.CfnUserPoolGroup;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /**
     * CloudWatch Log Group for Cognito
     * 
     * Stores logs from Cognito operations for debugging.
     * Retention set to 2 weeks to minimize costs while maintaining
     * sufficient debugging capability.
     */
    const cognitoLogGroup = new logs.LogGroup(this, 'CognitoLogGroup', {
      logGroupName: '/aws/cognito/health-command-center',
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Logs can be safely deleted
    });

    /**
     * Custom Message Lambda
     * 
     * This Lambda function customizes email messages sent by Cognito.
     * It allows for branded, user-friendly emails for:
     * - Sign-up verification
     * - Password reset
     * - MFA setup
     * - Admin-initiated actions
     * 
     * The Lambda code should be created at: lib/lambdas/custom-message/index.ts
     */
    const customMessageLambda = new nodejs.NodejsFunction(this, 'CustomMessageLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambdas/custom-message/index.ts'),
      functionName: 'health-command-center-custom-message',
      description: 'Customizes Cognito email messages for different scenarios',
      timeout: cdk.Duration.seconds(30), // Should complete quickly
      memorySize: 128, // Minimal memory needed for message formatting
      environment: {
        NODE_ENV: 'production',
      },
      logRetention: logs.RetentionDays.TWO_WEEKS,
      // Specify the pnpm lock file path explicitly
      depsLockFilePath: path.join(__dirname, '../../../../pnpm-lock.yaml'),
      bundling: {
        minify: true,
        sourceMap: false,
        target: 'es2020',
      },
    });

    /**
     * Grant Cognito permission to invoke the Lambda
     * Without this, Cognito triggers will fail
     */
    customMessageLambda.addPermission('CognitoInvoke', {
      principal: new iam.ServicePrincipal('cognito-idp.amazonaws.com'),
      action: 'lambda:InvokeFunction',
    });

    /**
     * Create Cognito User Pool
     * 
     * This is the main authentication service configuration.
     * Key decisions:
     * - Email as primary identifier (no separate username)
     * - Self-service registration enabled
     * - Strong password requirements
     * - Email-only recovery (no SMS to reduce costs)
     */
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'health-command-center-users',
      
      // Allow users to sign up themselves
      selfSignUpEnabled: true,
      
      // Use email as the sign-in method (not username)
      signInAliases: {
        email: true,
      },
      
      // Automatically send verification email
      autoVerify: {
        email: true,
      },
      
      // Email is required and cannot be changed after sign-up
      standardAttributes: {
        email: {
          required: true,
          mutable: false, // Prevents email changes for security
        },
      },
      
      /**
       * Password Policy
       * Strong requirements to enhance security:
       * - Minimum 8 characters
       * - Must include uppercase, lowercase, numbers, and symbols
       */
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      
      // Email-only recovery (no SMS to avoid costs)
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      
      /**
       * IMPORTANT: Set to RETAIN for production to prevent data loss
       * DESTROY is only safe for development environments
       */
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      
      // Admin invitation email template
      userInvitation: {
        emailSubject: 'Welcome to Health Command Center!',
        emailBody: 'Hello {username}, your temporary password is {####}',
      },
      
      // Attach the custom message Lambda
      lambdaTriggers: {
        customMessage: customMessageLambda,
      },
    });

    /**
     * Configure advanced security and email settings
     * Using CDK escape hatches to access CloudFormation properties
     */
    const cfnUserPool = this.userPool.node.defaultChild as cognito.CfnUserPool;
    
    /**
     * Enable advanced security features
     * This provides:
     * - Risk-based adaptive authentication
     * - Compromised credentials checking
     * - Account takeover protection
     */
    cfnUserPool.userPoolAddOns = {
      advancedSecurityMode: 'ENFORCED',
    };

    /**
     * Email configuration
     * Currently using Cognito's default email service.
     * For production with high volume, configure SES:
     * - Better deliverability
     * - Custom FROM address
     * - Higher sending limits
     */
    cfnUserPool.emailConfiguration = {
      emailSendingAccount: 'COGNITO_DEFAULT',
      // Uncomment and configure when using SES:
      // emailSendingAccount: 'DEVELOPER',
      // sourceArn: 'arn:aws:ses:us-west-2:YOUR_ACCOUNT:identity/healthcommandcenter.io',
      // from: 'noreply@healthcommandcenter.io',
    };

    /**
     * Customize verification email templates
     * These templates are used when users sign up or verify their email
     */
    cfnUserPool.verificationMessageTemplate = {
      defaultEmailOption: 'CONFIRM_WITH_CODE', // Send code instead of link
      emailSubject: 'Verify your Health Command Center account',
      emailMessage: 'Thank you for signing up for Health Command Center! Your verification code is {####}',
      emailMessageByLink: 'Thank you for signing up for Health Command Center! Please click {##Verify Email##} to confirm your account.',
      smsMessage: 'Your Health Command Center verification code is {####}', // Included for completeness
    };

    /**
     * Create User Pool Client
     * 
     * This client is used by the frontend application to interact with Cognito.
     * Configuration is optimized for a Single Page Application (SPA).
     */
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: 'health-command-center-web-client',
      
      /**
       * Authentication flows
       * - USER_PASSWORD_AUTH: Direct username/password (for testing)
       * - USER_SRP_AUTH: Secure Remote Password protocol (recommended)
       */
      authFlows: {
        userPassword: true, // Enable for easier testing
        userSrp: true,      // Secure protocol for production
      },
      
      // No secret for public clients (SPAs)
      generateSecret: false,
      
      // Prevents user enumeration attacks
      preventUserExistenceErrors: true,
      
      /**
       * Token validity settings
       * - Access token: 1 hour (for API calls)
       * - ID token: 1 hour (for user info)
       * - Refresh token: 30 days (for getting new tokens)
       */
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      
      // Attributes the client can read/write
      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true }),
      writeAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true }),
    });

    /**
     * IAM Role for Regular Users
     * 
     * This role is assumed by authenticated users in the regular users group.
     * Add policies here for resources regular users can access.
     */
    const regularUsersRole = new iam.Role(this, 'RegularUsersRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.userPool.userPoolId,
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      description: 'Role for regular users in Health Command Center',
    });

    /**
     * IAM Role for Admin Users
     * 
     * This role is assumed by authenticated users in the admin group.
     * Will have additional permissions compared to regular users.
     */
    const adminUsersRole = new iam.Role(this, 'AdminUsersRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.userPool.userPoolId,
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      description: 'Role for admin users in Health Command Center',
    });

    /**
     * CloudWatch Logs permissions
     * 
     * Both user groups can write logs for debugging.
     * This is useful for client-side error logging.
     */
    const cloudWatchPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: ['arn:aws:logs:*:*:*'], // Could be restricted further
    });

    regularUsersRole.addToPolicy(cloudWatchPolicy);
    adminUsersRole.addToPolicy(cloudWatchPolicy);

    /**
     * Create User Groups
     * 
     * Groups provide a way to manage permissions for sets of users.
     * Users can belong to multiple groups.
     */
    this.regularUsersGroup = new cognito.CfnUserPoolGroup(this, 'RegularUsersGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: UserGroup.REGULAR_USERS,
      description: 'Group for regular users',
      precedence: 10, // Higher number = lower priority
      roleArn: regularUsersRole.roleArn,
    });

    this.adminUsersGroup = new cognito.CfnUserPoolGroup(this, 'AdminUsersGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: UserGroup.ADMIN_USERS,
      description: 'Group for admin users',
      precedence: 1, // Lower number = higher priority
      roleArn: adminUsersRole.roleArn,
    });

    /**
     * Stack Outputs
     * 
     * These values are needed by the frontend application and other stacks.
     * They can be retrieved via CloudFormation exports or AWS CLI.
     */
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: 'HealthCommandCenter-UserPoolId',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: 'HealthCommandCenter-UserPoolClientId',
    });

    new cdk.CfnOutput(this, 'UserPoolDomain', {
      value: `https://cognito-idp.${this.region}.amazonaws.com/${this.userPool.userPoolId}`,
      description: 'Cognito User Pool Domain',
      exportName: 'HealthCommandCenter-UserPoolDomain',
    });

    new cdk.CfnOutput(this, 'RegularUsersGroupName', {
      value: this.regularUsersGroup.groupName!,
      description: 'Regular Users Group Name',
      exportName: 'HealthCommandCenter-RegularUsersGroup',
    });

    new cdk.CfnOutput(this, 'AdminUsersGroupName', {
      value: this.adminUsersGroup.groupName!,
      description: 'Admin Users Group Name',
      exportName: 'HealthCommandCenter-AdminUsersGroup',
    });

    // Tag all resources for cost tracking and organization
    cdk.Tags.of(this).add('Application', 'HealthCommandCenter');
    cdk.Tags.of(this).add('Stack', 'Auth');
  }
}
