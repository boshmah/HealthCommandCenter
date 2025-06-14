import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

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

    const { name, protein, carbs, fats, date } = parsedBody;
    const userId = event.requestContext.authorizer.claims.sub;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Name is required' }),
      };
    }

    // Parse and validate macronutrients
    const proteinValue = parseFloat(protein) || 0;
    const carbsValue = parseFloat(carbs) || 0;
    const fatsValue = parseFloat(fats) || 0;

    // Calculate calories: protein = 4 cal/g, carbs = 4 cal/g, fats = 9 cal/g
    const calories = Math.round((proteinValue * 4) + (carbsValue * 4) + (fatsValue * 9));

    // Generate unique food ID
    const foodId = `food-${randomUUID()}`;
    const currentDate = new Date();
    const timestamp = currentDate.getTime();
    const isoString = currentDate.toISOString();
    const foodDate = date || isoString.split('T')[0];

    // Create food item
    const foodItem = {
      PK: `USER#${userId}`,
      SK: `DATE#${foodDate}#TIME#${timestamp}#FOOD#${foodId}`,
      entityType: 'FOOD',
      foodId,
      userId,
      name: name.trim(),
      protein: proteinValue,
      carbs: carbsValue,
      fats: fatsValue,
      calories,
      date: foodDate,
      timestamp,
      createdAt: isoString,
      updatedAt: isoString,
    };

    // Save to DynamoDB
    try {
      await ddbDocClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: foodItem,
        ConditionExpression: 'attribute_not_exists(PK)',
      }));

      console.log('Food created successfully:', foodId);

      return {
        statusCode: 201,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          foodId,
          name: foodItem.name,
          protein: foodItem.protein,
          carbs: foodItem.carbs,
          fats: foodItem.fats,
          calories: foodItem.calories,
          date: foodItem.date,
          createdAt: foodItem.createdAt,
          updatedAt: foodItem.updatedAt,
        }),
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