import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { FoodEntity } from '@health-command-center/types';

/**
 * Lambda handler for getting a specific food entry
 * 
 * Endpoint: GET /foods/{foodId}
 * 
 * Returns a specific food entry by ID.
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Get food request:', JSON.stringify(event, null, 2));

  try {
    // Extract user ID from Cognito authorizer
    const userId = event.requestContext.authorizer?.claims?.sub;
    if (!userId) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    // Get food ID from path parameter
    const foodId = event.pathParameters?.foodId;
    if (!foodId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Food ID is required' }),
      };
    }

    // Initialize DynamoDB client
    const client = new DynamoDBClient({});
    const docClient = DynamoDBDocumentClient.from(client);

    // Query for the specific food
    // We need to search through all the user's foods since we don't know the date
    const result = await docClient.send(new QueryCommand({
      TableName: process.env.TABLE_NAME!,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      FilterExpression: 'foodId = :foodId',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':skPrefix': 'FOOD#',
        ':foodId': foodId,
      },
      Limit: 1,
    }));

    if (!result.Items || result.Items.length === 0) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Food not found' }),
      };
    }

    const food = result.Items[0] as FoodEntity;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        foodId: food.foodId,
        name: food.name,
        protein: food.protein,
        carbs: food.carbs,
        fats: food.fats,
        calories: food.calories,
        date: food.date,
        createdAt: food.createdAt,
        updatedAt: food.updatedAt,
      }),
    };
  } catch (error) {
    console.error('Error getting food:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
