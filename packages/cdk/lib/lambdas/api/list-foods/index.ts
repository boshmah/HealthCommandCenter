import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { FoodEntity, FoodKeys, FoodResponse } from '@health-command-center/types';

/**
 * Lambda handler for listing food entries
 * 
 * Endpoint: GET /foods?date=YYYY-MM-DD
 * 
 * If date is provided, returns foods for that specific date.
 * If date is not provided, returns foods for today.
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('List foods request:', JSON.stringify(event, null, 2));

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

    // Get date from query parameter or use today
    const date = event.queryStringParameters?.date || new Date().toISOString().split('T')[0];
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid date format. Use YYYY-MM-DD' }),
      };
    }

    // Initialize DynamoDB client
    const client = new DynamoDBClient({});
    const docClient = DynamoDBDocumentClient.from(client);

    // Query foods for the user and date
    const result = await docClient.send(new QueryCommand({
      TableName: process.env.TABLE_NAME!,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':skPrefix': FoodKeys.byDate(date),
      },
      ScanIndexForward: true, // Sort by timestamp ascending
    }));

    console.log(`Found ${result.Items?.length || 0} foods for date ${date}`);

    // Transform entities to response format
    const foods: FoodResponse[] = (result.Items || []).map((item: FoodEntity) => ({
      foodId: item.foodId,
      name: item.name,
      protein: item.protein,
      carbs: item.carbs,
      fats: item.fats,
      calories: item.calories,
      date: item.date,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    // Calculate daily totals
    const totals = foods.reduce((acc, food) => ({
      protein: acc.protein + food.protein,
      carbs: acc.carbs + food.carbs,
      fats: acc.fats + food.fats,
      calories: acc.calories + food.calories,
    }), { protein: 0, carbs: 0, fats: 0, calories: 0 });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        foods,
        totals,
        count: foods.length,
      }),
    };
  } catch (error) {
    console.error('Error listing foods:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
