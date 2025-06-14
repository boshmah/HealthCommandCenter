/**
 * Food-related types for the Health Command Center
 */

/**
 * Food entry entity stored in DynamoDB
 * PK: USER#<userId>
 * SK: DATE#<date>#TIME#<timestamp>#FOOD#<foodId>
 * 
 * This allows efficient queries:
 * - All foods for a user: PK = USER#<userId>, SK begins_with DATE#
 * - Foods for a user on a specific date: PK = USER#<userId>, SK begins_with DATE#<date>#
 * - Specific food item: PK = USER#<userId>, SK = DATE#<date>#TIME#<timestamp>#FOOD#<foodId>
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
    SK: `DATE#${date}#TIME#${timestamp}#FOOD#${foodId}`,
  }),
  
  /**
   * Generate the SK prefix for querying foods by date
   */
  byDate: (userId: string, date: string) => ({
    PK: `USER#${userId}`,
    SKPrefix: `DATE#${date}#`,
  }),
  
  /**
   * Generate the SK prefix for querying all foods for a user
   */
  allForUser: (userId: string) => ({
    PK: `USER#${userId}`,
    SKPrefix: 'DATE#',
  }),
};
