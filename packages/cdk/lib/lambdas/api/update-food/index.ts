import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand, DeleteCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { FoodEntity, FoodInput, FoodKeys } from '@health-command-center/types';

/**
 * Lambda handler for updating food entries
 * 
 * Endpoint: PUT /foods/{foodId}
 * 
 * Updates a food entry. If the date changes, the item is moved to a new SK.
 * Calories are automatically recalculated.
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Update food request:', JSON.stringify(event, null, 2));

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

    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    const input: FoodInput = JSON.parse(event.body);

    // Initialize DynamoDB client
    const client = new DynamoDBClient({});
    const docClient = DynamoDBDocumentClient.from(client);

    // First, find the existing food item
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

    const existingFood = queryResult.Items[0] as FoodEntity;
    
    // Calculate new calories
    const calories = calculateCalories(input.protein, input.carbs, input.fats);
    const now = new Date().toISOString();

    // Check if date has changed (requires moving the item)
    if (existingFood.date !== input.date) {
      // Delete old item
      await docClient.send(new DeleteCommand({
        TableName: process.env.TABLE_NAME!,
        Key: {
          PK: existingFood.PK,
          SK: existingFood.SK,
        },
      }));

      // Create new item with new SK
      const newKeys = FoodKeys.create(userId, input.date, existingFood.timestamp, foodId);
      const updatedFood: FoodEntity = {
        ...existingFood,
        ...newKeys,
        name: input.name,
        protein: input.protein,
        carbs: input.carbs,
        fats: input.fats,
        calories,
        date: input.date,
        updatedAt: now,
      };

      await docClient.send(new PutCommand({
        TableName: process.env.TABLE_NAME!,
        Item: updatedFood,
      }));

      console.log('Food updated with new date:', foodId);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          foodId: updatedFood.foodId,
          name: updatedFood.name,
          protein: updatedFood.protein,
          carbs: updatedFood.carbs,
          fats: updatedFood.fats,
          calories: updatedFood.calories,
          date: updatedFood.date,
          createdAt: updatedFood.createdAt,
          updatedAt: updatedFood.updatedAt,
        }),
      };
    } else {
      // Update in place if date hasn't changed
      await docClient.send(new UpdateCommand({
        TableName: process.env.TABLE_NAME!,
        Key: {
          PK: existingFood.PK,
          SK: existingFood.SK,
        },
        UpdateExpression: 'SET #name = :name, protein = :protein, carbs = :carbs, fats = :fats, calories = :calories, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#name': 'name', // 'name' is a reserved word
        },
        ExpressionAttributeValues: {
          ':name': input.name,
          ':protein': input.protein,
          ':carbs': input.carbs,
          ':fats': input.fats,
          ':calories': calories,
          ':updatedAt': now,
        },
      }));

      console.log('Food updated:', foodId);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          foodId,
          name: input.name,
          protein: input.protein,
          carbs: input.carbs,
          fats: input.fats,
          calories,
          date: input.date,
          createdAt: existingFood.createdAt,
          updatedAt: now,
        }),
      };
    }
  } catch (error) {
    console.error('Error updating food:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

/**
 * Calculate calories from macronutrients
 */
function calculateCalories(protein: number, carbs: number, fats: number): number {
  return Math.round((protein * 4) + (carbs * 4) + (fats * 9));
}
