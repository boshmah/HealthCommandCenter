import { jest } from '@jest/globals';
import { validateFoodInput, FoodInputData } from '../../../../packages/cdk/lib/lambdas/api/food/create-food/create-food-utils';

describe('validateFoodInput', () => {
  beforeEach(() => {
    jest.useFakeTimers({
      doNotFake: ['nextTick', 'setImmediate']
    });
    jest.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('successful validation', () => {
    it('should validate complete valid input', () => {
      const input: FoodInputData = {
        name: 'Test Food',
        protein: 10,
        carbs: 20,
        fats: 5,
        date: '2024-01-15'
      };

      const result = validateFoodInput(input);
      expect(result).toEqual({
        success: true,
        data: {
          name: 'Test Food',
          protein: 10,
          carbs: 20,
          fats: 5,
          calories: 165, // (10*4) + (20*4) + (5*9) = 40 + 80 + 45 = 165
          date: '2024-01-15'
        }
      });
    });

    it('should use current date when date is not provided', () => {
      const input: FoodInputData = {
        name: 'Test Food',
        protein: 10,
        carbs: 20,
        fats: 5
      };

      const result = validateFoodInput(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.date).toBe('2024-01-15');
      }
    });

    it('should handle string macronutrient values', () => {
      const input: FoodInputData = {
        name: 'Test Food',
        protein: '10.5',
        carbs: '20',
        fats: '5.5',
        date: '2024-01-15'
      };

      const result = validateFoodInput(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.protein).toBe(10.5);
        expect(result.data.carbs).toBe(20);
        expect(result.data.fats).toBe(5.5);
        expect(result.data.calories).toBe(172); // (10.5*4) + (20*4) + (5.5*9) = 42 + 80 + 49.5 = 171.5 → 172
      }
    });

    it('should handle missing macronutrients as 0', () => {
      const input: FoodInputData = {
        name: 'Test Food',
        date: '2024-01-15'
      };

      const result = validateFoodInput(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.protein).toBe(0);
        expect(result.data.carbs).toBe(0);
        expect(result.data.fats).toBe(0);
        expect(result.data.calories).toBe(0);
      }
    });

    it('should trim food names', () => {
      const input: FoodInputData = {
        name: '  Trimmed Food  ',
        protein: 10,
        carbs: 10,
        fats: 10,
        date: '2024-01-15'
      };

      const result = validateFoodInput(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Trimmed Food');
      }
    });
  });

  describe('name validation errors', () => {
    it('should return error for missing name', () => {
      const input: FoodInputData = {
        protein: 10,
        carbs: 20,
        fats: 5,
        date: '2024-01-15'
      };

      expect(validateFoodInput(input)).toEqual({
        success: false,
        error: 'Name is required'
      });
    });

    it('should return error for empty name', () => {
      const input: FoodInputData = {
        name: '',
        protein: 10,
        carbs: 20,
        fats: 5,
        date: '2024-01-15'
      };

      expect(validateFoodInput(input)).toEqual({
        success: false,
        error: 'Name is required'
      });
    });

    it('should return error for whitespace-only name', () => {
      const input: FoodInputData = {
        name: '   ',
        protein: 10,
        carbs: 20,
        fats: 5,
        date: '2024-01-15'
      };

      expect(validateFoodInput(input)).toEqual({
        success: false,
        error: 'Name is required'
      });
    });

    it('should return error for name exceeding max length', () => {
      const input: FoodInputData = {
        name: 'A'.repeat(201),
        protein: 10,
        carbs: 20,
        fats: 5,
        date: '2024-01-15'
      };

      expect(validateFoodInput(input)).toEqual({
        success: false,
        error: 'Name is too long (max 200 characters)'
      });
    });
  });

  describe('macronutrient validation errors', () => {
    it('should return error for negative protein', () => {
      const input: FoodInputData = {
        name: 'Test Food',
        protein: -10,
        carbs: 20,
        fats: 5,
        date: '2024-01-15'
      };

      expect(validateFoodInput(input)).toEqual({
        success: false,
        error: 'Protein cannot be negative'
      });
    });

    it('should return error for invalid carbs value', () => {
      const input: FoodInputData = {
        name: 'Test Food',
        protein: 10,
        carbs: 'invalid',
        fats: 5,
        date: '2024-01-15'
      };

      expect(validateFoodInput(input)).toEqual({
        success: false,
        error: 'Invalid Carbs value'
      });
    });

    it('should return error for fats exceeding maximum', () => {
      const input: FoodInputData = {
        name: 'Test Food',
        protein: 10,
        carbs: 20,
        fats: 15000,
        date: '2024-01-15'
      };

      expect(validateFoodInput(input)).toEqual({
        success: false,
        error: 'Fats value is too large'
      });
    });

    it('should validate macronutrients in order and return first error', () => {
      const input: FoodInputData = {
        name: 'Test Food',
        protein: -1, // Error
        carbs: 'invalid', // Also error
        fats: 20000, // Also error
        date: '2024-01-15'
      };

      // Should return the first error encountered (protein)
      expect(validateFoodInput(input)).toEqual({
        success: false,
        error: 'Protein cannot be negative'
      });
    });
  });

  describe('date validation errors', () => {
    it('should return error for invalid date format', () => {
      const input: FoodInputData = {
        name: 'Test Food',
        protein: 10,
        carbs: 20,
        fats: 5,
        date: '2024-13-01' // Invalid month
      };

      expect(validateFoodInput(input)).toEqual({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD'
      });
    });

    it('should return error for wrong date format', () => {
      const input: FoodInputData = {
        name: 'Test Food',
        protein: 10,
        carbs: 20,
        fats: 5,
        date: '15/01/2024' // DD/MM/YYYY format
      };

      expect(validateFoodInput(input)).toEqual({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD'
      });
    });

    it('should return error for invalid calendar date', () => {
      const input: FoodInputData = {
        name: 'Test Food',
        protein: 10,
        carbs: 20,
        fats: 5,
        date: '2024-02-30' // February 30th doesn't exist
      };

      expect(validateFoodInput(input)).toEqual({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD'
      });
    });
  });

  describe('edge cases', () => {
    it('should handle all fields at maximum valid values', () => {
      const input: FoodInputData = {
        name: 'A'.repeat(200),
        protein: 10000,
        carbs: 10000,
        fats: 10000,
        date: '9999-12-31'
      };

      const result = validateFoodInput(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.calories).toBe(170000); // (10000*4) + (10000*4) + (10000*9)
      }
    });

    it('should handle all macronutrients as null', () => {
      const input: FoodInputData = {
        name: 'Test Food',
        protein: null,
        carbs: null,
        fats: null,
        date: '2024-01-15'
      };

      const result = validateFoodInput(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.protein).toBe(0);
        expect(result.data.carbs).toBe(0);
        expect(result.data.fats).toBe(0);
        expect(result.data.calories).toBe(0);
      }
    });

    it('should handle mixed valid and invalid fields correctly', () => {
      const input: FoodInputData = {
        name: 'Valid Name',
        protein: 10,
        carbs: 20,
        fats: 5,
        date: 'invalid-date'
      };

      expect(validateFoodInput(input)).toEqual({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD'
      });
    });

    it('should calculate calories correctly for decimal values', () => {
      const input: FoodInputData = {
        name: 'Test Food',
        protein: 10.7,
        carbs: 20.3,
        fats: 5.9,
        date: '2024-01-15'
      };

      const result = validateFoodInput(input);
      expect(result.success).toBe(true);
      if (result.success) {
        // (10.7*4) + (20.3*4) + (5.9*9) = 42.8 + 81.2 + 53.1 = 177.1 → 177
        expect(result.data.calories).toBe(177);
      }
    });
  });

  describe('validation order', () => {
    it('should validate fields in correct order: name, protein, carbs, fats, date', () => {
      const input: FoodInputData = {
        name: '', // Error
        protein: -1, // Error
        carbs: 'invalid', // Error
        fats: 20000, // Error
        date: 'invalid' // Error
      };

      // Should return name error first
      expect(validateFoodInput(input)).toEqual({
        success: false,
        error: 'Name is required'
      });
    });
  });
});
