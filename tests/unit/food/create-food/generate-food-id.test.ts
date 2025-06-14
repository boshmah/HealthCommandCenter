import { jest } from '@jest/globals';

// Create mock before imports
const mockRandomUUID = jest.fn();

// Use unstable_mockModule for ESM
jest.unstable_mockModule('crypto', () => ({
  randomUUID: mockRandomUUID
}));

// Dynamic import after mocking
const { generateFoodId } = await import('../../../../packages/cdk/lib/lambdas/api/food/create-food/create-food-utils.js');

describe('generateFoodId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('standard functionality', () => {
    it('should generate food ID with correct prefix', () => {
      mockRandomUUID.mockReturnValue('123e4567-e89b-12d3-a456-426614174000');
      
      const foodId = generateFoodId();
      
      expect(foodId).toBe('food-123e4567-e89b-12d3-a456-426614174000');
      expect(mockRandomUUID).toHaveBeenCalledTimes(1);
    });

    it('should use food- prefix consistently', () => {
      mockRandomUUID.mockReturnValue('00000000-0000-0000-0000-000000000000');
      
      const foodId = generateFoodId();
      
      expect(foodId.startsWith('food-')).toBe(true);
      expect(foodId).toBe('food-00000000-0000-0000-0000-000000000000');
    });
  });

  describe('uniqueness', () => {
    it('should generate different IDs on multiple calls', () => {
      const mockUuids = [
        '123e4567-e89b-12d3-a456-426614174000',
        '987fcdeb-51a2-43d1-b678-123456789abc',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      ] as const;
      
      mockRandomUUID
        .mockReturnValueOnce(mockUuids[0])
        .mockReturnValueOnce(mockUuids[1])
        .mockReturnValueOnce(mockUuids[2]);
      
      const id1 = generateFoodId();
      const id2 = generateFoodId();
      const id3 = generateFoodId();
      
      expect(id1).toBe(`food-${mockUuids[0]}`);
      expect(id2).toBe(`food-${mockUuids[1]}`);
      expect(id3).toBe(`food-${mockUuids[2]}`);
      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it('should call randomUUID for each generation', () => {
      mockRandomUUID.mockReturnValue('11111111-1111-1111-1111-111111111111');
      
      generateFoodId();
      generateFoodId();
      generateFoodId();
      
      expect(mockRandomUUID).toHaveBeenCalledTimes(3);
    });
  });

  describe('format validation', () => {
    it('should maintain UUID format in the ID', () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      mockRandomUUID.mockReturnValue(validUuid);
      
      const foodId = generateFoodId();
      
      expect(foodId).toBe(`food-${validUuid}`);
      expect(foodId).toMatch(/^food-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should handle different UUID formats from crypto', () => {
      // Test uppercase UUID
      mockRandomUUID.mockReturnValue('550E8400-E29B-41D4-A716-446655440000');
      
      const foodId1 = generateFoodId();
      expect(foodId1).toBe('food-550E8400-E29B-41D4-A716-446655440000');
      
      // Test lowercase UUID
      mockRandomUUID.mockReturnValue('550e8400-e29b-41d4-a716-446655440000');
      
      const foodId2 = generateFoodId();
      expect(foodId2).toBe('food-550e8400-e29b-41d4-a716-446655440000');
    });
  });

  describe('error handling', () => {
    it('should propagate errors from randomUUID', () => {
      mockRandomUUID.mockImplementation(() => {
        throw new Error('Crypto error');
      });
      
      expect(() => generateFoodId()).toThrow('Crypto error');
    });
  });
});
