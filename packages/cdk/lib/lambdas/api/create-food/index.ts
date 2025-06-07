import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { FoodEntity, FoodInput, FoodKeys } from '@health-command-center/types';

/**
 * Lambda handler for creating food entries
 * 
 * Endpoint: POST /foods
 * 
 * Request body:
 * {
 *   "name": "Chicken Breast",
 *   "protein": 30,
 *   "carbs": 0,
 *   "fats": 3,
 *   "date": "2024-01-15"
 * }
 * 
 * Calories are automatically calculated:
 * - Protein: 4 calories per gram
 * - Carbs: 4 calories per gram
 * - Fats: 9 calories per gram
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Create food request:', JSON.stringify(event, null, 2));

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

    // Parse and validate request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    const input: FoodInput = JSON.parse(event.body);
    
    // Calculate calories automatically
    const calories = calculateCalories(input.protein, input.carbs, input.fats);

    // Generate IDs and timestamps
    const foodId = uuidv4();
    const timestamp = Date.now();
    const now = new Date().toISOString();

    // Create DynamoDB keys
    const keys = FoodKeys.create(userId, input.date, timestamp, foodId);

    // Create food entity
    const foodEntity: FoodEntity = {
      ...keys,
      entityType: 'FOOD',
      foodId,
      userId,
      date: input.date,
      timestamp,
      name: input.name,
      protein: input.protein,
      carbs: input.carbs,
      fats: input.fats,
      calories,
      createdAt: now,
      updatedAt: now,
    };

    // Initialize DynamoDB client
    const client = new DynamoDBClient({});
    const docClient = DynamoDBDocumentClient.from(client);

    // Save to DynamoDB
    await docClient.send(new PutCommand({
      TableName: process.env.TABLE_NAME!,
      Item: foodEntity,
      ConditionExpression: 'attribute_not_exists(PK)', // Prevent overwrites
    }));

    console.log('Food created successfully:', foodId);

    // Return created food
    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        foodId: foodEntity.foodId,
        name: foodEntity.name,
        protein: foodEntity.protein,
        carbs: foodEntity.carbs,
        fats: foodEntity.fats,
        calories: foodEntity.calories,
        date: foodEntity.date,
        createdAt: foodEntity.createdAt,
        updatedAt: foodEntity.updatedAt,
      }),
    };
  } catch (error) {
    console.error('Error creating food:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

/**
 * Calculate calories from macronutrients
 * @param protein - Grams of protein (4 cal/g)
 * @param carbs - Grams of carbohydrates (4 cal/g)
 * @param fats - Grams of fats (9 cal/g)
 * @returns Total calories
 */
function calculateCalories(protein: number, carbs: number, fats: number): number {
  return Math.round((protein * 4) + (carbs * 4) + (fats * 9));
}
