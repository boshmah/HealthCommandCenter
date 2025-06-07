import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { RemovalPolicy } from 'aws-cdk-lib';

/**
 * Database construct for the Health Command Center application.
 * Implements a single table design pattern for DynamoDB.
 * 
 * Table Design:
 * - PK: USER#<userId>
 * - SK: FOOD#<date>#<timestamp>#<foodId>
 * 
 * This design supports efficient queries for:
 * - All foods for a user on a specific date (most common)
 * - All foods for a user within a date range
 * - No GSI required, reducing costs
 */
export class Database extends Construct {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Create the main DynamoDB table with single table design
    this.table = new dynamodb.Table(this, 'MainTable', {
      tableName: 'HealthCommandCenterTable',
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY, // Change to RETAIN for production
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    // Add a type attribute for entity identification
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: {
        name: 'GSI1PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI1SK',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });
  }
}
