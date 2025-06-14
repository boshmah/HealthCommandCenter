import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { 
  validateFoodInput, 
  createFoodEntity, 
  extractResponseData,
  generateFoodId 
} from './create-food-utils.js';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-west-2' });
const ddbDocClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME;

/**
 * Lambda handler for creating food entries
 * 
 * @param event - API Gateway proxy event
 * @param context - Lambda context
 * @returns API Gateway proxy result
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    // Log the incoming request
    console.log('Create food request:', JSON.stringify(event));

    // Validate environment variables
    if (!TABLE_NAME) {
      console.error('TABLE_NAME environment variable is not set');
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Internal server error' }),
      };
    }

    // Check authorization
    if (!event.requestContext?.authorizer?.claims?.sub) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    // Validate request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    // Parse request body
    let parsedBody;
    try {
      parsedBody = JSON.parse(event.body);
    } catch (error) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Invalid request body' }),
      };
    }

    const userId = event.requestContext.authorizer.claims.sub;

    // Validate input data
    const validationResult = validateFoodInput(parsedBody);
    if (!validationResult.success) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: validationResult.error }),
      };
    }

    // Generate food ID
    const foodId = generateFoodId();

    // Create food entity
    const foodEntity = createFoodEntity(userId, validationResult.data, foodId);

    // Save to DynamoDB
    try {
      await ddbDocClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: foodEntity,
        ConditionExpression: 'attribute_not_exists(PK)',
      }));

      console.log('Food created successfully:', foodId);

      // Extract response data
      const responseData = extractResponseData(foodEntity);

      return {
        statusCode: 201,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(responseData),
      };
    } catch (error: any) {
      console.error('Error creating food:', error);
      
      if (error.name === 'ConditionalCheckFailedException') {
        return {
          statusCode: 409,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ error: 'Food item already exists' }),
        };
      }

      if (error.name === 'ProvisionedThroughputExceededException') {
        return {
          statusCode: 503,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ error: 'Service temporarily unavailable' }),
        };
      }

      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Internal server error' }),
      };
    }
  } catch (error) {
    console.error('Error creating food:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};