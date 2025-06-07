import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { FoodEntity } from '@health-command-center/types';

/**
 * Lambda handler for deleting food entries
 * 
 * Endpoint: DELETE /foods/{foodId}
 * 
 * Deletes a food entry by ID.
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Delete food request:', JSON.stringify(event, null, 2));

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

    // First, find the food item to get its keys
    const queryResult = await docClient.send(new QueryCommand({
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

    if (!queryResult.Items || queryResult.Items.length === 0) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Food not found' }),
      };
    }

    const food = queryResult.Items[0] as FoodEntity;

    // Delete the food item
    await docClient.send(new DeleteCommand({
      TableName: process.env.TABLE_NAME!,
      Key: {
        PK: food.PK,
        SK: food.SK,
      },
    }));

    console.log('Food deleted successfully:', foodId);

    return {
      statusCode: 204, // No content
      headers: { 'Content-Type': 'application/json' },
      body: '',
    };
  } catch (error) {
    console.error('Error deleting food:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
