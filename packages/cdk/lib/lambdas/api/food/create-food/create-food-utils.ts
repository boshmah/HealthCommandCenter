import { randomUUID } from 'crypto';
import { FoodEntity } from '@health-command-center/types';

/**
 * Interface for food input validation
 */
export interface FoodInputData {
  name?: any;
  protein?: any;
  carbs?: any;
  fats?: any;
  date?: any;
}

/**
 * Interface for validated food data
 */
export interface ValidatedFoodData {
  name: string;
  protein: number;
  carbs: number;
  fats: number;
  calories: number;
  date: string;
}

/**
 * Validation result type
 */
export type ValidationResult = 
  | { success: true; data: ValidatedFoodData }
  | { success: false; error: string };

/**
 * Calculate calories from macronutrients
 * @param protein - Protein in grams
 * @param carbs - Carbohydrates in grams
 * @param fats - Fats in grams
 * @returns Total calories (rounded)
 */
export function calculateCalories(protein: number, carbs: number, fats: number): number {
  // Protein: 4 cal/g, Carbs: 4 cal/g, Fats: 9 cal/g
  return Math.round((protein * 4) + (carbs * 4) + (fats * 9));
}

/**
 * Validate and parse macronutrient value
 * @param value - The value to parse
 * @param fieldName - Name of the field for error messages
 * @returns Parsed number or validation error
 */
export function parseMacronutrient(value: any, fieldName: string): number | { error: string } {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  // Check for arrays and objects first
  if (typeof value === 'object') {
    return { error: `Invalid ${fieldName} value` };
  }

  // For strings, check if it's a pure number (including scientific notation)
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Updated regex to support scientific notation
    if (!/^-?\d*\.?\d+([eE][+-]?\d+)?$/.test(trimmed)) {
      return { error: `Invalid ${fieldName} value` };
    }
    value = trimmed;
  }

  const parsed = parseFloat(value);
  
  if (isNaN(parsed)) {
    return { error: `Invalid ${fieldName} value` };
  }

  if (parsed < 0) {
    return { error: `${fieldName} cannot be negative` };
  }

  if (parsed > 10000) {
    return { error: `${fieldName} value is too large` };
  }

  return parsed;
}

/**
 * Validate date format (YYYY-MM-DD)
 * @param date - The date string to validate
 * @returns true if valid, false otherwise
 */
export function isValidDateFormat(date: string): boolean {
  if (!date || typeof date !== 'string') {
    return false;
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return false;
  }

  // Check if it's a valid date
  const [year, month, day] = date.split('-').map(Number);
  
  // Handle very early years that JavaScript Date might not support well
  if (year < 100) {
    // For years 1-99, check basic validity
    if (year < 1 || year > 9999) return false;
    if (month < 1 || month > 12) return false;
    
    // Days in month check
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    
    // Leap year check for February
    if (month === 2) {
      const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
      const maxDay = isLeapYear ? 29 : 28;
      return day >= 1 && day <= maxDay;
    }
    
    return day >= 1 && day <= daysInMonth[month - 1];
  }
  
  const dateObj = new Date(year, month - 1, day);
  
  return dateObj.getFullYear() === year &&
         dateObj.getMonth() === month - 1 &&
         dateObj.getDate() === day;
}

/**
 * Get current date in YYYY-MM-DD format
 * @returns Current date string
 */
export function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Validate food name
 * @param name - The food name to validate
 * @returns Validation result
 */
export function validateFoodName(name: any): string | { error: string } {
  if (!name || typeof name !== 'string') {
    return { error: 'Name is required' };
  }

  const trimmedName = name.trim();
  
  if (trimmedName === '') {
    return { error: 'Name is required' };
  }

  if (trimmedName.length > 200) {
    return { error: 'Name is too long (max 200 characters)' };
  }

  return trimmedName;
}

/**
 * Validate all food input data
 * @param input - Raw input data
 * @returns Validation result with parsed data or error
 */
export function validateFoodInput(input: FoodInputData): ValidationResult {
  // Validate name
  const nameResult = validateFoodName(input.name);
  if (typeof nameResult === 'object' && 'error' in nameResult) {
    return { success: false, error: nameResult.error };
  }

  // Validate macronutrients
  const proteinResult = parseMacronutrient(input.protein, 'Protein');
  if (typeof proteinResult === 'object' && 'error' in proteinResult) {
    return { success: false, error: proteinResult.error };
  }

  const carbsResult = parseMacronutrient(input.carbs, 'Carbs');
  if (typeof carbsResult === 'object' && 'error' in carbsResult) {
    return { success: false, error: carbsResult.error };
  }

  const fatsResult = parseMacronutrient(input.fats, 'Fats');
  if (typeof fatsResult === 'object' && 'error' in fatsResult) {
    return { success: false, error: fatsResult.error };
  }

  // Validate date
  const date = input.date || getCurrentDate();
  if (!isValidDateFormat(date)) {
    return { success: false, error: 'Invalid date format. Use YYYY-MM-DD' };
  }

  // Calculate calories
  const calories = calculateCalories(
    proteinResult as number,
    carbsResult as number,
    fatsResult as number
  );

  return {
    success: true,
    data: {
      name: nameResult as string,
      protein: proteinResult as number,
      carbs: carbsResult as number,
      fats: fatsResult as number,
      calories,
      date
    }
  };
}

/**
 * Generate a unique food ID
 * @returns Unique food ID with prefix
 */
export function generateFoodId(): string {
  return `food-${randomUUID()}`;
}

/**
 * Create a FoodEntity from validated data
 * @param userId - The user ID
 * @param validatedData - Validated food data
 * @param foodId - Optional food ID (will generate if not provided)
 * @returns Complete FoodEntity for DynamoDB
 */
export function createFoodEntity(
  userId: string,
  validatedData: ValidatedFoodData,
  foodId?: string
): FoodEntity {
  const id = foodId || generateFoodId();
  const now = new Date();
  const timestamp = now.getTime();
  const isoString = now.toISOString();

  return {
    PK: `USER#${userId}`,
    SK: `DATE#${validatedData.date}#TIME#${timestamp}#FOOD#${id}`,
    entityType: 'FOOD',
    foodId: id,
    userId,
    name: validatedData.name,
    protein: validatedData.protein,
    carbs: validatedData.carbs,
    fats: validatedData.fats,
    calories: validatedData.calories,
    date: validatedData.date,
    timestamp,
    createdAt: isoString,
    updatedAt: isoString,
  };
}

/**
 * Extract response data from FoodEntity
 * @param entity - The FoodEntity
 * @returns Response data without sensitive fields
 */
export function extractResponseData(entity: FoodEntity) {
  return {
    foodId: entity.foodId,
    name: entity.name,
    protein: entity.protein,
    carbs: entity.carbs,
    fats: entity.fats,
    calories: entity.calories,
    date: entity.date,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
