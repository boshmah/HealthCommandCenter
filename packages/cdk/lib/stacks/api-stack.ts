import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { fileURLToPath } from 'url';
import * as path from 'path';
import { Database } from '../constructs/database.js';

/**
 * Properties for the API Stack
 */
export interface ApiStackProps extends cdk.StackProps {
  /**
   * The Cognito User Pool for authentication
   */
  userPool: cognito.IUserPool;
  
  /**
   * The User Pool Client for authentication
   */
  userPoolClient: cognito.IUserPoolClient;
}

/**
 * API Stack for Health Command Center
 * 
 * This stack creates the REST API infrastructure for managing food entries.
 * It provides CRUD operations with Cognito authentication and automatic calorie calculation.
 * 
 * Features:
 * - REST API with Cognito User Pool Authorizer
 * - Lambda functions for food entry management
 * - DynamoDB single table design
 * - Automatic calorie calculation (4 cal/g protein & carbs, 9 cal/g fats)
 * - CloudWatch logging for debugging
 * - Cost-optimized with pay-per-request DynamoDB billing
 * 
 * API Endpoints:
 * - POST   /foods          - Create food entry
 * - GET    /foods          - List foods for a date (query param: date)
 * - GET    /foods/{foodId} - Get specific food entry
 * - PUT    /foods/{foodId} - Update food entry
 * - DELETE /foods/{foodId} - Delete food entry
 * 
 * Cost Considerations:
 * - API Gateway: $3.50 per million API calls
 * - Lambda: First 1M requests/month free
 * - DynamoDB: Pay-per-request (~$0.25 per million reads/writes)
 * - CloudWatch Logs: $0.50/GB ingested
 * - Total estimated cost for moderate usage: <$10/month
 */
export class ApiStack extends cdk.Stack {
  /**
   * The REST API instance
   */
  public readonly api: apigateway.RestApi;
  
  /**
   * The DynamoDB table for storing data
   */
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // Helper to get current directory in ES modules
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    /**
     * Create DynamoDB Table
     * Using single table design as per requirements
     */
    const database = new Database(this, 'Database');
    this.table = database.table;

    /**
     * Create REST API
     */
    this.api = new apigateway.RestApi(this, 'HealthCommandCenterApi', {
      restApiName: 'health-command-center-api',
      description: 'API for Health Command Center macronutrient tracking',
      deployOptions: {
        stageName: 'prod',
        // Enable CloudWatch logging
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
        // Throttling to prevent abuse and control costs
        throttlingRateLimit: 100, // requests per second
        throttlingBurstLimit: 200,
      },
      // CORS configuration for frontend
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS, // Will restrict in production
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
      // Enable compression to reduce data transfer costs
      minimumCompressionSize: 1024,
    });

    /**
     * Create Cognito Authorizer
     * This validates JWT tokens from the User Pool
     */
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [props.userPool],
      authorizerName: 'HealthCommandCenterAuthorizer',
      identitySource: 'method.request.header.Authorization',
    });

    /**
     * Lambda Execution Role
     * Shared role for all Lambda functions with necessary permissions
     */
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Execution role for Health Command Center API Lambda functions',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant DynamoDB permissions
    this.table.grantReadWriteData(lambdaRole);

    /**
     * CloudWatch Log Group for Lambda functions
     */
    const apiLogGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      logGroupName: '/aws/lambda/health-command-center-api',
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    /**
     * Common Lambda environment variables
     */
    const commonEnv = {
      TABLE_NAME: this.table.tableName,
      NODE_ENV: 'production',
      LOG_LEVEL: 'INFO',
    };

    /**
     * Create Food Lambda
     * POST /foods
     */
    const createFoodLambda = new nodejs.NodejsFunction(this, 'CreateFoodLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambdas/api/create-food/index.ts'),
      functionName: 'health-command-center-create-food',
      description: 'Creates a new food entry with automatic calorie calculation',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: commonEnv,
      role: lambdaRole,
      logRetention: logs.RetentionDays.TWO_WEEKS,
      depsLockFilePath: path.join(__dirname, '../../../../pnpm-lock.yaml'),
      bundling: {
        minify: true,
        sourceMap: false,
        target: 'es2020',
        externalModules: ['aws-sdk'], // Provided by Lambda runtime
      },
    });

    /**
     * List Foods Lambda
     * GET /foods?date=YYYY-MM-DD
     */
    const listFoodsLambda = new nodejs.NodejsFunction(this, 'ListFoodsLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambdas/api/list-foods/index.ts'),
      functionName: 'health-command-center-list-foods',
      description: 'Lists food entries for a specific date',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: commonEnv,
      role: lambdaRole,
      logRetention: logs.RetentionDays.TWO_WEEKS,
      depsLockFilePath: path.join(__dirname, '../../../../pnpm-lock.yaml'),
      bundling: {
        minify: true,
        sourceMap: false,
        target: 'es2020',
        externalModules: ['aws-sdk'],
      },
    });

    /**
     * Get Food Lambda
     * GET /foods/{foodId}
     */
    const getFoodLambda = new nodejs.NodejsFunction(this, 'GetFoodLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambdas/api/get-food/index.ts'),
      functionName: 'health-command-center-get-food',
      description: 'Gets a specific food entry',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: commonEnv,
      role: lambdaRole,
      logRetention: logs.RetentionDays.TWO_WEEKS,
      depsLockFilePath: path.join(__dirname, '../../../../pnpm-lock.yaml'),
      bundling: {
        minify: true,
        sourceMap: false,
        target: 'es2020',
        externalModules: ['aws-sdk'],
      },
    });

    /**
     * Update Food Lambda
     * PUT /foods/{foodId}
     */
    const updateFoodLambda = new nodejs.NodejsFunction(this, 'UpdateFoodLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambdas/api/update-food/index.ts'),
      functionName: 'health-command-center-update-food',
      description: 'Updates a food entry with automatic calorie recalculation',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: commonEnv,
      role: lambdaRole,
      logRetention: logs.RetentionDays.TWO_WEEKS,
      depsLockFilePath: path.join(__dirname, '../../../../pnpm-lock.yaml'),
      bundling: {
        minify: true,
        sourceMap: false,
        target: 'es2020',
        externalModules: ['aws-sdk'],
      },
    });

    /**
     * Delete Food Lambda
     * DELETE /foods/{foodId}
     */
    const deleteFoodLambda = new nodejs.NodejsFunction(this, 'DeleteFoodLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambdas/api/delete-food/index.ts'),
      functionName: 'health-command-center-delete-food',
      description: 'Deletes a food entry',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: commonEnv,
      role: lambdaRole,
      logRetention: logs.RetentionDays.TWO_WEEKS,
      depsLockFilePath: path.join(__dirname, '../../../../pnpm-lock.yaml'),
      bundling: {
        minify: true,
        sourceMap: false,
        target: 'es2020',
        externalModules: ['aws-sdk'],
      },
    });

    /**
     * API Resources and Methods
     */
    const foodsResource = this.api.root.addResource('foods');
    const foodItemResource = foodsResource.addResource('{foodId}');

    // POST /foods
    foodsResource.addMethod('POST', new apigateway.LambdaIntegration(createFoodLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestValidator: new apigateway.RequestValidator(this, 'CreateFoodValidator', {
        restApi: this.api,
        requestValidatorName: 'create-food-validator',
        validateRequestBody: true,
        validateRequestParameters: false,
      }),
      requestModels: {
        'application/json': new apigateway.Model(this, 'CreateFoodModel', {
          restApi: this.api,
          contentType: 'application/json',
          schema: {
            type: apigateway.JsonSchemaType.OBJECT,
            required: ['name', 'protein', 'carbs', 'fats', 'date'],
            properties: {
              name: { type: apigateway.JsonSchemaType.STRING },
              protein: { type: apigateway.JsonSchemaType.NUMBER, minimum: 0 },
              carbs: { type: apigateway.JsonSchemaType.NUMBER, minimum: 0 },
              fats: { type: apigateway.JsonSchemaType.NUMBER, minimum: 0 },
              date: { 
                type: apigateway.JsonSchemaType.STRING,
                pattern: '^\\d{4}-\\d{2}-\\d{2}$', // YYYY-MM-DD format
              },
            },
          },
        }),
      },
    });

    // GET /foods
    foodsResource.addMethod('GET', new apigateway.LambdaIntegration(listFoodsLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestParameters: {
        'method.request.querystring.date': false, // Optional date parameter
      },
    });

    // GET /foods/{foodId}
    foodItemResource.addMethod('GET', new apigateway.LambdaIntegration(getFoodLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // PUT /foods/{foodId}
    foodItemResource.addMethod('PUT', new apigateway.LambdaIntegration(updateFoodLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestValidator: new apigateway.RequestValidator(this, 'UpdateFoodValidator', {
        restApi: this.api,
        requestValidatorName: 'update-food-validator',
        validateRequestBody: true,
        validateRequestParameters: false,
      }),
      requestModels: {
        'application/json': new apigateway.Model(this, 'UpdateFoodModel', {
          restApi: this.api,
          contentType: 'application/json',
          schema: {
            type: apigateway.JsonSchemaType.OBJECT,
            required: ['name', 'protein', 'carbs', 'fats', 'date'],
            properties: {
              name: { type: apigateway.JsonSchemaType.STRING },
              protein: { type: apigateway.JsonSchemaType.NUMBER, minimum: 0 },
              carbs: { type: apigateway.JsonSchemaType.NUMBER, minimum: 0 },
              fats: { type: apigateway.JsonSchemaType.NUMBER, minimum: 0 },
              date: { 
                type: apigateway.JsonSchemaType.STRING,
                pattern: '^\\d{4}-\\d{2}-\\d{2}$',
              },
            },
          },
        }),
      },
    });

    // DELETE /foods/{foodId}
    foodItemResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteFoodLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    /**
     * Store API URL in SSM for other stacks
     */
    new ssm.StringParameter(this, 'ApiUrlParameter', {
      parameterName: '/health-command-center/api-url',
      stringValue: this.api.url,
      description: 'API Gateway URL for Health Command Center',
    });

    /**
     * Stack Outputs
     */
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
      exportName: 'HealthCommandCenter-ApiUrl',
    });

    new cdk.CfnOutput(this, 'ApiId', {
      value: this.api.restApiId,
      description: 'API Gateway ID',
      exportName: 'HealthCommandCenter-ApiId',
    });

    new cdk.CfnOutput(this, 'TableName', {
      value: this.table.tableName,
      description: 'DynamoDB Table Name',
      exportName: 'HealthCommandCenter-TableName',
    });

    // Tag all resources
    cdk.Tags.of(this).add('Application', 'HealthCommandCenter');
    cdk.Tags.of(this).add('Stack', 'Api');
  }
}
