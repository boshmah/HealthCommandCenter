import { parseMacronutrient } from '../../../../packages/cdk/lib/lambdas/api/food/create-food/create-food-utils';

describe('parseMacronutrient', () => {
  describe('valid numeric inputs', () => {
    it('should parse integer values correctly', () => {
      expect(parseMacronutrient(10, 'Protein')).toBe(10);
      expect(parseMacronutrient(0, 'Carbs')).toBe(0);
      expect(parseMacronutrient(100, 'Fats')).toBe(100);
    });

    it('should parse decimal values correctly', () => {
      expect(parseMacronutrient(10.5, 'Protein')).toBe(10.5);
      expect(parseMacronutrient(25.25, 'Carbs')).toBe(25.25);
      expect(parseMacronutrient(0.1, 'Fats')).toBe(0.1);
    });

    it('should parse string numbers correctly', () => {
      expect(parseMacronutrient('25.5', 'Protein')).toBe(25.5);
      expect(parseMacronutrient('0', 'Carbs')).toBe(0);
      expect(parseMacronutrient('100.0', 'Fats')).toBe(100);
    });

    it('should handle scientific notation', () => {
      expect(parseMacronutrient('1e2', 'Protein')).toBe(100);
      expect(parseMacronutrient(1e-1, 'Carbs')).toBe(0.1);
    });
  });

  describe('null/undefined/empty handling', () => {
    it('should return 0 for null values', () => {
      expect(parseMacronutrient(null, 'Protein')).toBe(0);
    });

    it('should return 0 for undefined values', () => {
      expect(parseMacronutrient(undefined, 'Carbs')).toBe(0);
    });

    it('should return 0 for empty string', () => {
      expect(parseMacronutrient('', 'Fats')).toBe(0);
    });
  });

  describe('invalid inputs', () => {
    it('should return error for non-numeric strings', () => {
      expect(parseMacronutrient('abc', 'Protein')).toEqual({ error: 'Invalid Protein value' });
      expect(parseMacronutrient('10g', 'Carbs')).toEqual({ error: 'Invalid Carbs value' });
      expect(parseMacronutrient('ten', 'Fats')).toEqual({ error: 'Invalid Fats value' });
    });

    it('should return error for objects', () => {
      expect(parseMacronutrient({}, 'Protein')).toEqual({ error: 'Invalid Protein value' });
      expect(parseMacronutrient({ value: 10 }, 'Carbs')).toEqual({ error: 'Invalid Carbs value' });
    });

    it('should return error for arrays', () => {
      expect(parseMacronutrient([], 'Protein')).toEqual({ error: 'Invalid Protein value' });
      expect(parseMacronutrient([10], 'Carbs')).toEqual({ error: 'Invalid Carbs value' });
    });

    it('should return error for boolean values', () => {
      expect(parseMacronutrient(true, 'Protein')).toEqual({ error: 'Invalid Protein value' });
      expect(parseMacronutrient(false, 'Carbs')).toEqual({ error: 'Invalid Carbs value' });
    });

    it('should return error for NaN', () => {
      expect(parseMacronutrient(NaN, 'Protein')).toEqual({ error: 'Invalid Protein value' });
      expect(parseMacronutrient('NaN', 'Carbs')).toEqual({ error: 'Invalid Carbs value' });
    });
  });

  describe('validation rules', () => {
    it('should return error for negative values', () => {
      expect(parseMacronutrient(-5, 'Protein')).toEqual({ error: 'Protein cannot be negative' });
      expect(parseMacronutrient('-10', 'Carbs')).toEqual({ error: 'Carbs cannot be negative' });
      expect(parseMacronutrient(-0.1, 'Fats')).toEqual({ error: 'Fats cannot be negative' });
    });

    it('should return error for values exceeding 10000', () => {
      expect(parseMacronutrient(10001, 'Protein')).toEqual({ error: 'Protein value is too large' });
      expect(parseMacronutrient('15000', 'Carbs')).toEqual({ error: 'Carbs value is too large' });
      expect(parseMacronutrient(10000.1, 'Fats')).toEqual({ error: 'Fats value is too large' });
    });

    it('should accept values at boundaries', () => {
      expect(parseMacronutrient(0, 'Protein')).toBe(0);
      expect(parseMacronutrient(10000, 'Carbs')).toBe(10000);
    });
  });

  describe('field name in error messages', () => {
    it('should include correct field name in error messages', () => {
      expect(parseMacronutrient(-1, 'Protein')).toEqual({ error: 'Protein cannot be negative' });
      expect(parseMacronutrient(-1, 'Carbs')).toEqual({ error: 'Carbs cannot be negative' });
      expect(parseMacronutrient(-1, 'Fats')).toEqual({ error: 'Fats cannot be negative' });
      expect(parseMacronutrient(-1, 'CustomField')).toEqual({ error: 'CustomField cannot be negative' });
    });
  });

  describe('special numeric cases', () => {
    it('should handle Infinity', () => {
      expect(parseMacronutrient(Infinity, 'Protein')).toEqual({ error: 'Protein value is too large' });
      expect(parseMacronutrient(-Infinity, 'Carbs')).toEqual({ error: 'Carbs cannot be negative' });
    });

    it('should handle very small positive numbers', () => {
      expect(parseMacronutrient(0.00001, 'Protein')).toBe(0.00001);
      expect(parseMacronutrient('0.00001', 'Carbs')).toBe(0.00001);
    });

    it('should handle number-like strings with spaces', () => {
      expect(parseMacronutrient(' 10 ', 'Protein')).toBe(10);
      expect(parseMacronutrient('  25.5  ', 'Carbs')).toBe(25.5);
    });
  });
});
