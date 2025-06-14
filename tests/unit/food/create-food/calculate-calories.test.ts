import { calculateCalories } from '../../../../packages/cdk/lib/lambdas/api/food/create-food/create-food-utils';

describe('calculateCalories', () => {
  describe('standard calculations', () => {
    it('should calculate calories correctly for typical values', () => {
      expect(calculateCalories(25, 30, 10)).toBe(310); // (25*4) + (30*4) + (10*9) = 100 + 120 + 90 = 310
      expect(calculateCalories(50, 0, 0)).toBe(200); // Protein only
      expect(calculateCalories(0, 100, 0)).toBe(400); // Carbs only
      expect(calculateCalories(0, 0, 20)).toBe(180); // Fats only
    });

    it('should return 0 when all macros are 0', () => {
      expect(calculateCalories(0, 0, 0)).toBe(0);
    });
  });

  describe('decimal handling', () => {
    it('should round decimal results correctly', () => {
      expect(calculateCalories(10.5, 20.25, 5.75)).toBe(175); // 42 + 81 + 51.75 = 174.75 → 175
      expect(calculateCalories(1.1, 1.1, 1.1)).toBe(19); // 4.4 + 4.4 + 9.9 = 18.7 → 19
      expect(calculateCalories(0.1, 0.1, 0.1)).toBe(2); // 0.4 + 0.4 + 0.9 = 1.7 → 2
    });

    it('should handle very small decimal values', () => {
      expect(calculateCalories(0.01, 0.01, 0.01)).toBe(0); // 0.04 + 0.04 + 0.09 = 0.17 → 0
      expect(calculateCalories(0.49, 0.49, 0.49)).toBe(8); // 1.96 + 1.96 + 4.41 = 8.33 → 8
    });
  });

  describe('edge cases', () => {
    it('should handle negative values (though not valid in real use)', () => {
      expect(calculateCalories(-10, -5, -2)).toBe(-78); // (-10*4) + (-5*4) + (-2*9) = -40 + -20 + -18 = -78
      expect(calculateCalories(-1, 5, 2)).toBe(34); // (-1*4) + (5*4) + (2*9) = -4 + 20 + 18 = 34
    });

    it('should handle very large values', () => {
      expect(calculateCalories(1000, 1000, 1000)).toBe(17000); // (1000*4) + (1000*4) + (1000*9) = 4000 + 4000 + 9000 = 17000
      expect(calculateCalories(9999, 9999, 9999)).toBe(169983); // (9999*4) + (9999*4) + (9999*9) = 39996 + 39996 + 89991 = 169983
    });

    it('should handle mixed positive and negative values', () => {
      expect(calculateCalories(10, -5, 3)).toBe(47); // (10*4) + (-5*4) + (3*9) = 40 + -20 + 27 = 47
      expect(calculateCalories(-10, 20, -5)).toBe(-5); // (-10*4) + (20*4) + (-5*9) = -40 + 80 + -45 = -5
    });
  });

  describe('precision and rounding', () => {
    it('should round up at 0.5 and above', () => {
      // Test case that results in exactly .5
      expect(calculateCalories(0.125, 0.125, 0.125)).toBe(2); // 0.5 + 0.5 + 1.125 = 2.125 → 2
      expect(calculateCalories(10.875, 0, 0)).toBe(44); // 43.5 → 44
    });

    it('should round down below 0.5', () => {
      expect(calculateCalories(10.1, 0, 0)).toBe(40); // 40.4 → 40
      expect(calculateCalories(0, 0, 5.04)).toBe(45); // 45.36 → 45
    });
  });
});
