import { extractResponseData } from '../../../../packages/cdk/lib/lambdas/api/food/create-food/create-food-utils';
import type { FoodEntity } from '../../../../packages/types/src/food-entity';

describe('extractResponseData', () => {
  describe('field extraction', () => {
    it('should extract only public fields from entity', () => {
      const entity: FoodEntity = {
        PK: 'USER#user-123',
        SK: 'DATE#2024-01-15#TIME#1705320000000#FOOD#food-abc',
        entityType: 'FOOD',
        foodId: 'food-abc',
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
      };

      const response = extractResponseData(entity);

      expect(response).toEqual({
        foodId: 'food-abc',
        name: 'Chicken Breast',
        protein: 30,
        carbs: 0,
        fats: 3,
        calories: 147,
        date: '2024-01-15',
        createdAt: '2024-01-15T12:00:00.000Z',
        updatedAt: '2024-01-15T12:00:00.000Z'
      });
    });

    it('should exclude all sensitive/internal fields', () => {
      const entity: FoodEntity = {
        PK: 'USER#user-456',
        SK: 'DATE#2024-02-20#TIME#1708444800000#FOOD#food-xyz',
        entityType: 'FOOD',
        foodId: 'food-xyz',
        userId: 'user-456',
        name: 'Test Food',
        protein: 10,
        carbs: 20,
        fats: 5,
        calories: 165,
        date: '2024-02-20',
        timestamp: 1708444800000,
        createdAt: '2024-02-20T12:00:00.000Z',
        updatedAt: '2024-02-20T13:00:00.000Z'
      };

      const response = extractResponseData(entity);

      // Ensure excluded fields are not present
      expect(response).not.toHaveProperty('PK');
      expect(response).not.toHaveProperty('SK');
      expect(response).not.toHaveProperty('entityType');
      expect(response).not.toHaveProperty('userId');
      expect(response).not.toHaveProperty('timestamp');
    });
  });

  describe('data preservation', () => {
    it('should preserve decimal values in macronutrients', () => {
      const entity: FoodEntity = {
        PK: 'USER#user-123',
        SK: 'DATE#2024-01-15#TIME#1705320000000#FOOD#food-123',
        entityType: 'FOOD',
        foodId: 'food-123',
        userId: 'user-123',
        name: 'Mixed Meal',
        protein: 25.5,
        carbs: 30.75,
        fats: 10.25,
        calories: 318,
        date: '2024-01-15',
        timestamp: 1705320000000,
        createdAt: '2024-01-15T12:00:00.000Z',
        updatedAt: '2024-01-15T12:00:00.000Z'
      };

      const response = extractResponseData(entity);

      expect(response.protein).toBe(25.5);
      expect(response.carbs).toBe(30.75);
      expect(response.fats).toBe(10.25);
    });

    it('should preserve special characters in food name', () => {
      const entity: FoodEntity = {
        PK: 'USER#user-123',
        SK: 'DATE#2024-01-15#TIME#1705320000000#FOOD#food-123',
        entityType: 'FOOD',
        foodId: 'food-123',
        userId: 'user-123',
        name: 'Ben & Jerry\'s Ice Cream 🍦',
        protein: 5,
        carbs: 30,
        fats: 15,
        calories: 275,
        date: '2024-01-15',
        timestamp: 1705320000000,
        createdAt: '2024-01-15T12:00:00.000Z',
        updatedAt: '2024-01-15T12:00:00.000Z'
      };

      const response = extractResponseData(entity);

      expect(response.name).toBe('Ben & Jerry\'s Ice Cream 🍦');
    });

    it('should preserve different timestamp formats', () => {
      const entity: FoodEntity = {
        PK: 'USER#user-123',
        SK: 'DATE#2024-01-15#TIME#1705320000000#FOOD#food-123',
        entityType: 'FOOD',
        foodId: 'food-123',
        userId: 'user-123',
        name: 'Test Food',
        protein: 10,
        carbs: 10,
        fats: 10,
        calories: 170,
        date: '2024-01-15',
        timestamp: 1705320000000,
        createdAt: '2024-01-15T08:30:45.123Z',
        updatedAt: '2024-01-15T16:45:30.999Z'
      };

      const response = extractResponseData(entity);

      expect(response.createdAt).toBe('2024-01-15T08:30:45.123Z');
      expect(response.updatedAt).toBe('2024-01-15T16:45:30.999Z');
    });
  });

  describe('edge cases', () => {
    it('should handle zero values correctly', () => {
      const entity: FoodEntity = {
        PK: 'USER#user-123',
        SK: 'DATE#2024-01-15#TIME#1705320000000#FOOD#food-123',
        entityType: 'FOOD',
        foodId: 'food-123',
        userId: 'user-123',
        name: 'Water',
        protein: 0,
        carbs: 0,
        fats: 0,
        calories: 0,
        date: '2024-01-15',
        timestamp: 1705320000000,
        createdAt: '2024-01-15T12:00:00.000Z',
        updatedAt: '2024-01-15T12:00:00.000Z'
      };

      const response = extractResponseData(entity);

      expect(response.protein).toBe(0);
      expect(response.carbs).toBe(0);
      expect(response.fats).toBe(0);
      expect(response.calories).toBe(0);
    });

    it('should handle very long food names', () => {
      const longName = 'A'.repeat(200);
      const entity: FoodEntity = {
        PK: 'USER#user-123',
        SK: 'DATE#2024-01-15#TIME#1705320000000#FOOD#food-123',
        entityType: 'FOOD',
        foodId: 'food-123',
        userId: 'user-123',
        name: longName,
        protein: 10,
        carbs: 10,
        fats: 10,
        calories: 170,
        date: '2024-01-15',
        timestamp: 1705320000000,
        createdAt: '2024-01-15T12:00:00.000Z',
        updatedAt: '2024-01-15T12:00:00.000Z'
      };

      const response = extractResponseData(entity);

      expect(response.name).toBe(longName);
      expect(response.name.length).toBe(200);
    });

    it('should handle different date formats', () => {
      const entity: FoodEntity = {
        PK: 'USER#user-123',
        SK: 'DATE#2025-12-31#TIME#1735660800000#FOOD#food-123',
        entityType: 'FOOD',
        foodId: 'food-123',
        userId: 'user-123',
        name: 'New Year Eve Food',
        protein: 20,
        carbs: 40,
        fats: 10,
        calories: 330,
        date: '2025-12-31',
        timestamp: 1735660800000,
        createdAt: '2025-12-31T00:00:00.000Z',
        updatedAt: '2025-12-31T23:59:59.999Z'
      };

      const response = extractResponseData(entity);

      expect(response.date).toBe('2025-12-31');
    });
  });

  describe('return structure', () => {
    it('should return object with exact field structure', () => {
      const entity: FoodEntity = {
        PK: 'USER#user-123',
        SK: 'DATE#2024-01-15#TIME#1705320000000#FOOD#food-123',
        entityType: 'FOOD',
        foodId: 'food-123',
        userId: 'user-123',
        name: 'Test',
        protein: 1,
        carbs: 2,
        fats: 3,
        calories: 39,
        date: '2024-01-15',
        timestamp: 1705320000000,
        createdAt: '2024-01-15T12:00:00.000Z',
        updatedAt: '2024-01-15T12:00:00.000Z'
      };

      const response = extractResponseData(entity);
      const keys = Object.keys(response);

      expect(keys).toEqual([
        'foodId',
        'name',
        'protein',
        'carbs',
        'fats',
        'calories',
        'date',
        'createdAt',
        'updatedAt'
      ]);
      expect(keys.length).toBe(9);
    });
  });
});
