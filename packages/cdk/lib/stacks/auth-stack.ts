import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { UserGroup } from '../../../types/src/index';

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly regularUsersGroup: cognito.CfnUserPoolGroup;
  public readonly adminUsersGroup: cognito.CfnUserPoolGroup;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // CloudWatch Log Group for Cognito
    const cognitoLogGroup = new logs.LogGroup(this, 'CognitoLogGroup', {
      logGroupName: '/aws/cognito/health-command-center',
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'health-command-center-users',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // WARNING: DESTROY will delete all user data! Change to RETAIN for production
      userInvitation: {
        emailSubject: 'Welcome to Health Command Center!',
        emailBody: 'Hello {username}, your temporary password is {####}',
      },
      lambdaTriggers: {
        // We'll add lambda triggers later if needed
      },
    });

    // Enable CloudWatch logging for the User Pool
    const cfnUserPool = this.userPool.node.defaultChild as cognito.CfnUserPool;
    cfnUserPool.userPoolAddOns = {
      advancedSecurityMode: 'ENFORCED',
    };

    // Create User Pool Client
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: 'health-command-center-web-client',
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false, // For SPA, we don't need a secret
      preventUserExistenceErrors: true,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true }),
      writeAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true }),
    });

    // IAM Role for Regular Users
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

    // IAM Role for Admin Users
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

    // Add CloudWatch Logs permissions to both roles
    const cloudWatchPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: ['arn:aws:logs:*:*:*'],
    });

    regularUsersRole.addToPolicy(cloudWatchPolicy);
    adminUsersRole.addToPolicy(cloudWatchPolicy);

    // Create User Groups
    this.regularUsersGroup = new cognito.CfnUserPoolGroup(this, 'RegularUsersGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: UserGroup.REGULAR_USERS,
      description: 'Group for regular users',
      precedence: 10,
      roleArn: regularUsersRole.roleArn,
    });

    this.adminUsersGroup = new cognito.CfnUserPoolGroup(this, 'AdminUsersGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: UserGroup.ADMIN_USERS,
      description: 'Group for admin users',
      precedence: 1, // Lower number = higher priority
      roleArn: adminUsersRole.roleArn,
    });

    // Output important values
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

    // Tag all resources
    cdk.Tags.of(this).add('Application', 'HealthCommandCenter');
    cdk.Tags.of(this).add('Stack', 'Auth');
  }
}
