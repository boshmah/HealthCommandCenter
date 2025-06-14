import { jest } from '@jest/globals';
import type { ValidatedFoodData } from '../../../../packages/cdk/lib/lambdas/api/food/create-food/create-food-utils.js';

// Create mock before imports
const mockRandomUUID = jest.fn();

// Use unstable_mockModule for ESM
jest.unstable_mockModule('crypto', () => ({
  randomUUID: mockRandomUUID
}));

// Dynamic import after mocking - only import the function, not the type
const { createFoodEntity } = await import('../../../../packages/cdk/lib/lambdas/api/food/create-food/create-food-utils.js');

describe('createFoodEntity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({
      doNotFake: ['nextTick', 'setImmediate'] // Don't fake these to avoid hanging
    });
    jest.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));

    // Reset the mock to default value
    mockRandomUUID.mockReturnValue('12345678-1234-1234-1234-123456789012');
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('entity creation with provided foodId', () => {
    it('should create complete food entity with all fields', () => {
      const userId = 'user-123';
      const validatedData: ValidatedFoodData = {
        name: 'Chicken Breast',
        protein: 30,
        carbs: 0,
        fats: 3,
        calories: 147,
        date: '2024-01-15'
      };
      const foodId = 'food-custom-id';

      const entity = createFoodEntity(userId, validatedData, foodId);

      expect(entity).toEqual({
        PK: 'USER#user-123',
        SK: 'DATE#2024-01-15#TIME#1705320000000#FOOD#food-custom-id',
        entityType: 'FOOD',
        foodId: 'food-custom-id',
        userId: 'user-123',
        name: 'Chicken Breast',
        protein: 30,
        carbs: 0,
        fats: 3,
        calories: 147,
        date: '2024-01-15',
        timestamp: 1705320000000,
        createdAt: '2024-01-15T12:00:00.000Z',
        updatedAt: '2024-01-15T12:00:00.000Z'
      });
    });

    it('should handle decimal macronutrient values', () => {
      const validatedData: ValidatedFoodData = {
        name: 'Mixed Meal',
        protein: 25.5,
        carbs: 30.75,
        fats: 10.25,
        calories: 318,
        date: '2024-01-15'
      };

      const entity = createFoodEntity('user-456', validatedData, 'food-123');

      expect(entity.protein).toBe(25.5);
      expect(entity.carbs).toBe(30.75);
      expect(entity.fats).toBe(10.25);
    });
  });

  describe('entity creation without foodId', () => {
    it('should auto-generate foodId when not provided', () => {
      const validatedData: ValidatedFoodData = {
        name: 'Rice',
        protein: 5,
        carbs: 45,
        fats: 0.5,
        calories: 204,
        date: '2024-01-15'
      };

      const entity = createFoodEntity('user-789', validatedData);

      expect(entity.foodId).toBe('food-12345678-1234-1234-1234-123456789012');
      expect(entity.SK).toContain('FOOD#food-12345678-1234-1234-1234-123456789012');
      expect(mockRandomUUID).toHaveBeenCalledTimes(1);
    });

    it('should not call randomUUID when foodId is provided', () => {
      const validatedData: ValidatedFoodData = {
        name: 'Test Food',
        protein: 10,
        carbs: 10,
        fats: 10,
        calories: 170,
        date: '2024-01-15'
      };

      mockRandomUUID.mockClear();
      createFoodEntity('user-123', validatedData, 'provided-id');

      expect(mockRandomUUID).not.toHaveBeenCalled();
    });
  });

  describe('key formatting', () => {
    it('should format PK correctly', () => {
      const validatedData: ValidatedFoodData = {
        name: 'Test',
        protein: 0,
        carbs: 0,
        fats: 0,
        calories: 0,
        date: '2024-01-15'
      };

      const entity = createFoodEntity('abc123', validatedData, 'food-1');
      expect(entity.PK).toBe('USER#abc123');
    });

    it('should format SK with correct structure and order', () => {
      const validatedData: ValidatedFoodData = {
        name: 'Test',
        protein: 0,
        carbs: 0,
        fats: 0,
        calories: 0,
        date: '2024-03-20'
      };

      jest.setSystemTime(new Date('2024-03-20T15:30:45.123Z'));
      const entity = createFoodEntity('user-1', validatedData, 'food-xyz');

      expect(entity.SK).toBe('DATE#2024-03-20#TIME#1710948645123#FOOD#food-xyz');
      expect(entity.timestamp).toBe(1710948645123);
    });
  });

  describe('timestamp handling', () => {
    it('should use consistent timestamps', () => {
      const validatedData: ValidatedFoodData = {
        name: 'Test',
        protein: 0,
        carbs: 0,
        fats: 0,
        calories: 0,
        date: '2024-01-15'
      };

      const entity = createFoodEntity('user-1', validatedData, 'food-1');

      expect(entity.timestamp).toBe(1705320000000);
      expect(entity.createdAt).toBe('2024-01-15T12:00:00.000Z');
      expect(entity.updatedAt).toBe('2024-01-15T12:00:00.000Z');
      expect(entity.createdAt).toBe(entity.updatedAt);
    });

    it('should handle different timezones correctly', () => {
      const validatedData: ValidatedFoodData = {
        name: 'Test',
        protein: 0,
        carbs: 0,
        fats: 0,
        calories: 0,
        date: '2024-12-31'
      };

      jest.setSystemTime(new Date('2024-12-31T23:59:59.999Z'));
      const entity = createFoodEntity('user-1', validatedData, 'food-1');

      expect(entity.timestamp).toBe(1735689599999);
      expect(entity.createdAt).toBe('2024-12-31T23:59:59.999Z');
    });
  });

  describe('data integrity', () => {
    it('should preserve all validated data fields', () => {
      const validatedData: ValidatedFoodData = {
        name: 'Complex Food Name with Special Chars & Numbers 123',
        protein: 99.99,
        carbs: 88.88,
        fats: 77.77,
        calories: 1234,
        date: '2025-06-15'
      };

      const entity = createFoodEntity('user-special', validatedData, 'food-special');

      expect(entity.name).toBe(validatedData.name);
      expect(entity.protein).toBe(validatedData.protein);
      expect(entity.carbs).toBe(validatedData.carbs);
      expect(entity.fats).toBe(validatedData.fats);
      expect(entity.calories).toBe(validatedData.calories);
      expect(entity.date).toBe(validatedData.date);
    });

    it('should always set entityType to FOOD', () => {
      const validatedData: ValidatedFoodData = {
        name: 'Test',
        protein: 0,
        carbs: 0,
        fats: 0,
        calories: 0,
        date: '2024-01-15'
      };

      const entity = createFoodEntity('user-1', validatedData);
      expect(entity.entityType).toBe('FOOD');
    });
  });

  describe('edge cases', () => {
    it('should handle zero values for all macronutrients', () => {
      const validatedData: ValidatedFoodData = {
        name: 'Water',
        protein: 0,
        carbs: 0,
        fats: 0,
        calories: 0,
        date: '2024-01-15'
      };

      const entity = createFoodEntity('user-1', validatedData);

      expect(entity.protein).toBe(0);
      expect(entity.carbs).toBe(0);
      expect(entity.fats).toBe(0);
      expect(entity.calories).toBe(0);
    });

    it('should handle dates at year boundaries', () => {
      const validatedData: ValidatedFoodData = {
        name: 'New Year Food',
        protein: 10,
        carbs: 10,
        fats: 10,
        calories: 170,
        date: '2024-12-31'
      };

      jest.setSystemTime(new Date('2024-12-31T23:59:59.999Z'));
      const entity = createFoodEntity('user-1', validatedData);

      expect(entity.date).toBe('2024-12-31');
      expect(entity.SK).toContain('DATE#2024-12-31');
    });

    it('should handle very long user IDs', () => {
      const longUserId = 'user-' + 'a'.repeat(100);
      const validatedData: ValidatedFoodData = {
        name: 'Test',
        protein: 0,
        carbs: 0,
        fats: 0,
        calories: 0,
        date: '2024-01-15'
      };

      const entity = createFoodEntity(longUserId, validatedData);
      expect(entity.PK).toBe(`USER#${longUserId}`);
      expect(entity.userId).toBe(longUserId);
    });
  });
});
