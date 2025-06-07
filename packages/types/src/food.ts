/**
 * Food-related types for the Health Command Center
 */

/**
 * Food entry entity stored in DynamoDB
 * PK: USER#<userId>
 * SK: FOOD#<date>#<timestamp>#<foodId>
 * 
 * Example SK: FOOD#2024-01-15#1705344000000#123e4567-e89b-12d3-a456-426614174000
 */
export interface FoodEntity {
  // DynamoDB keys
  PK: string;
  SK: string;
  
  // Entity metadata
  entityType: 'FOOD';
  createdAt: string;
  updatedAt: string;
  
  // Food-specific fields
  foodId: string;
  userId: string;
  date: string; // ISO date format: YYYY-MM-DD
  timestamp: number;
  name: string;
  protein: number; // in grams
  carbs: number; // in grams
  fats: number; // in grams
  calories: number;
}

/**
 * Food input for creating/updating food entries
 */
export interface FoodInput {
  name: string;
  protein: number;
  carbs: number;
  fats: number;
  calories: number;
  date: string; // ISO date format: YYYY-MM-DD
}

/**
 * Food response for API responses
 */
export interface FoodResponse {
  foodId: string;
  name: string;
  protein: number;
  carbs: number;
  fats: number;
  calories: number;
  date: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Key generation utilities for consistent key formatting
 */
export const FoodKeys = {
  /**
   * Generate PK and SK for a food entry
   */
  create: (userId: string, date: string, timestamp: number, foodId: string) => ({
    PK: `USER#${userId}`,
    SK: `FOOD#${date}#${timestamp}#${foodId}`,
  }),
  
  /**
   * Generate the SK prefix for querying foods by date
   */
  byDate: (date: string) => `FOOD#${date}#`,
  
  /**
   * Generate the SK prefix for querying all foods
   */
  prefix: () => 'FOOD#',
};
