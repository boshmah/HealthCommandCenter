import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

/**
 * Authentication Stack for Health Command Center
 * 
 * This stack sets up AWS Cognito User Pool for user authentication and authorization.
 * It includes:
 * - User Pool with email-based authentication
 * - Two user groups: regular-users and admin-users
 * - Custom email templates via Lambda trigger
 * - CloudWatch logging for debugging
 * 
 * @class AuthStack
 * @extends {cdk.Stack}
 * 
 * AWS Services Used:
 * - AWS Cognito User Pool: User authentication
 * - AWS Lambda: Custom email messages
 * - CloudWatch Logs: Lambda debugging
 */
export class AuthStack extends cdk.Stack {
  /**
   * The Cognito User Pool instance
   * Exposed for use by other stacks (e.g., API Gateway authorizers)
   */
  public readonly userPool: cognito.UserPool;
  
  /**
   * The Cognito User Pool Client
   * Used by frontend applications to authenticate users
   */
  public readonly userPoolClient: cognito.UserPoolClient;
  
  /**
   * The admin users group
   * Members have elevated permissions in the application
   */
  public readonly adminGroup: cognito.CfnUserPoolGroup;
  
  /**
   * The regular users group
   * Standard application users
   */
  public readonly regularGroup: cognito.CfnUserPoolGroup;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /**
     * Custom Message Lambda Function
     * 
     * This Lambda customizes email messages sent by Cognito for:
     * - Sign up verification
     * - Password reset
     * - Email verification
     * - Admin-created users
     */
    const customMessageLambda = new nodejs.NodejsFunction(this, 'CustomMessageLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, 'lambdas/custom-message/index.ts'),
      timeout: cdk.Duration.seconds(10), // Email generation should be fast
      memorySize: 128, // Minimal memory needed for email templating
      logRetention: logs.RetentionDays.ONE_WEEK, // Reduce log storage costs
      environment: {
        NODE_OPTIONS: '--enable-source-maps', // Better error debugging
      },
      bundling: {
        minify: true, // Reduce package size
        sourceMap: true, // Enable debugging
      },
    });

    /**
     * Cognito User Pool
     * 
     * Central authentication service for the application.
     * Configuration choices explained:
     */
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'HealthCommandCenter-UserPool',
      
      /**
       * Self Sign Up Configuration
       * - Allows users to register themselves
       * - Requires email verification before account activation
       */
      selfSignUpEnabled: true,
      
      /**
       * Sign In Configuration
       * - Users can sign in with email address
       * - More user-friendly than username-based auth
       */
      signInAliases: {
        email: true,
        username: false, // Disable username sign-in for consistency
      },
      
      /**
       * Auto-verified Attributes
       * - Email is marked for auto-verification
       * - Users must verify via code sent to email
       */
      autoVerify: {
        email: true,
      },
      
      /**
       * Standard User Attributes
       * - Email is required and mutable
       * - Can add more attributes later if needed
       */
      standardAttributes: {
        email: {
          required: true,
          mutable: true, // Users can update their email
        },
      },
      
      /**
       * Password Policy
       * - Enforces strong passwords
       * - Balances security with user convenience
       */
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(7), // Admin-created temp passwords
      },
      
      /**
       * Account Recovery
       * - Uses email for password reset
       * - More secure than security questions
       */
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      
      /**
       * Lambda Triggers
       * - Custom message trigger for branded emails
       * - Can add more triggers later (pre-auth, post-auth, etc.)
       */
      lambdaTriggers: {
        customMessage: customMessageLambda,
      },
      
      /**
       * Deletion Protection
       * - Prevents accidental deletion of user pool
       * - Critical for production environments
       */
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      
      /**
       * Email Configuration
       * - Uses Cognito's default email service
       * - For production, consider using SES for better deliverability
       */
      email: cognito.UserPoolEmail.withCognito(),
    });

    /**
     * Grant Lambda permission to be invoked by Cognito
     * Required for the custom message trigger to work
     */
    customMessageLambda.addPermission('CognitoInvoke', {
      principal: new iam.ServicePrincipal('cognito-idp.amazonaws.com'),
      sourceArn: this.userPool.userPoolArn,
    });

    /**
     * User Pool Client
     * 
     * Defines how applications interact with the User Pool.
     * This client is used by the frontend React application.
     */
    this.userPoolClient = this.userPool.addClient('UserPoolClient', {
      userPoolClientName: 'HealthCommandCenter-WebClient',
      
      /**
       * OAuth Configuration
       * - Not using OAuth flows for this app
       * - Using direct username/password authentication
       */
      generateSecret: false, // Public client (SPA)
      
      /**
       * Authentication Flows
       * - USER_PASSWORD_AUTH: Direct username/password
       * - REFRESH_TOKEN_AUTH: Token refresh without re-authentication
       */
      authFlows: {
        userPassword: true, // Enable USER_PASSWORD_AUTH flow
        userSrp: false, // Disable SRP for simplicity
        custom: false, // No custom auth challenges
        adminUserPassword: false, // Admin API not used by client
      },
      
      /**
       * Token Validity
       * - Access token: 1 hour (for API calls)
       * - ID token: 1 hour (for user identity)
       * - Refresh token: 30 days (stay logged in)
       */
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      
      /**
       * Token Configuration
       * - Prevent tokens from being used by other clients
       * - Security best practice
       */
      preventUserExistenceErrors: true, // Don't leak user existence info
      enableTokenRevocation: true, // Allow token revocation for security
      
      /**
       * Attribute Read/Write Permissions
       * - Client can read email and email_verified
       * - Client can write email (for updates)
       */
      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true, emailVerified: true }),
      writeAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true }),
    });

    /**
     * Admin Users Group
     * 
     * Members of this group have administrative privileges.
     * The frontend and API can check group membership for authorization.
     */
    this.adminGroup = new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'admin-users',
      description: 'Administrative users with elevated permissions',
      precedence: 1, // Lower number = higher priority
    });

    /**
     * Regular Users Group
     * 
     * Standard application users.
     * Default group for most users.
     */
    this.regularGroup = new cognito.CfnUserPoolGroup(this, 'RegularGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'regular-users',
      description: 'Regular application users',
      precedence: 10, // Lower priority than admin
    });

    /**
     * Stack Outputs
     * 
     * These values are needed by:
     * - Frontend application (for Cognito configuration)
     * - API stack (for JWT authorization)
     * - Testing tools (Postman collection)
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

    new cdk.CfnOutput(this, 'AdminUsersGroupName', {
      value: this.adminGroup.groupName!,
      description: 'Admin users group name',
      exportName: 'HealthCommandCenter-AdminGroupName',
    });

    new cdk.CfnOutput(this, 'RegularUsersGroupName', {
      value: this.regularGroup.groupName!,
      description: 'Regular users group name',
      exportName: 'HealthCommandCenter-RegularGroupName',
    });
  }
}
