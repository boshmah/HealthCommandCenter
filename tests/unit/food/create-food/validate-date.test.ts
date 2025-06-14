import { jest } from '@jest/globals';
import { isValidDateFormat, getCurrentDate } from '../../../../packages/cdk/lib/lambdas/api/food/create-food/create-food-utils';

describe('Date Validation Functions', () => {
  describe('isValidDateFormat', () => {
    describe('valid date formats', () => {
      it('should accept correct YYYY-MM-DD format', () => {
        expect(isValidDateFormat('2024-01-15')).toBe(true);
        expect(isValidDateFormat('2024-12-31')).toBe(true);
        expect(isValidDateFormat('2000-01-01')).toBe(true);
        expect(isValidDateFormat('2099-12-31')).toBe(true);
      });

      it('should validate leap year dates', () => {
        expect(isValidDateFormat('2024-02-29')).toBe(true); // 2024 is a leap year
        expect(isValidDateFormat('2000-02-29')).toBe(true); // 2000 is a leap year
        expect(isValidDateFormat('2020-02-29')).toBe(true); // 2020 is a leap year
      });

      it('should validate month boundaries', () => {
        expect(isValidDateFormat('2024-01-31')).toBe(true); // January has 31 days
        expect(isValidDateFormat('2024-04-30')).toBe(true); // April has 30 days
        expect(isValidDateFormat('2024-02-28')).toBe(true); // Non-leap year February
        expect(isValidDateFormat('2023-02-28')).toBe(true); // 2023 is not a leap year
      });
    });

    describe('invalid date formats', () => {
      it('should reject incorrect separators', () => {
        expect(isValidDateFormat('2024/01/15')).toBe(false);
        expect(isValidDateFormat('2024.01.15')).toBe(false);
        expect(isValidDateFormat('2024 01 15')).toBe(false);
        expect(isValidDateFormat('2024_01_15')).toBe(false);
      });

      it('should reject incorrect date order', () => {
        expect(isValidDateFormat('15-01-2024')).toBe(false); // DD-MM-YYYY
        expect(isValidDateFormat('01-15-2024')).toBe(false); // MM-DD-YYYY
        expect(isValidDateFormat('15/01/2024')).toBe(false);
      });

      it('should reject missing leading zeros', () => {
        expect(isValidDateFormat('2024-1-15')).toBe(false);
        expect(isValidDateFormat('2024-01-5')).toBe(false);
        expect(isValidDateFormat('2024-1-5')).toBe(false);
      });

      it('should reject invalid string formats', () => {
        expect(isValidDateFormat('not-a-date')).toBe(false);
        expect(isValidDateFormat('2024')).toBe(false);
        expect(isValidDateFormat('2024-01')).toBe(false);
        expect(isValidDateFormat('Jan 15, 2024')).toBe(false);
        expect(isValidDateFormat('2024-01-15T00:00:00')).toBe(false); // ISO with time
      });

      it('should reject empty or invalid types', () => {
        expect(isValidDateFormat('')).toBe(false);
        expect(isValidDateFormat(null as any)).toBe(false);
        expect(isValidDateFormat(undefined as any)).toBe(false);
        expect(isValidDateFormat(123 as any)).toBe(false);
        expect(isValidDateFormat({} as any)).toBe(false);
        expect(isValidDateFormat([] as any)).toBe(false);
      });
    });

    describe('invalid calendar dates', () => {
      it('should reject invalid months', () => {
        expect(isValidDateFormat('2024-00-15')).toBe(false); // Month 0
        expect(isValidDateFormat('2024-13-01')).toBe(false); // Month 13
        expect(isValidDateFormat('2024-99-01')).toBe(false); // Month 99
      });

      it('should reject invalid days', () => {
        expect(isValidDateFormat('2024-01-00')).toBe(false); // Day 0
        expect(isValidDateFormat('2024-01-32')).toBe(false); // January 32
        expect(isValidDateFormat('2024-04-31')).toBe(false); // April 31 (April has 30 days)
        expect(isValidDateFormat('2024-06-31')).toBe(false); // June 31 (June has 30 days)
        expect(isValidDateFormat('2024-02-30')).toBe(false); // February 30
      });

      it('should reject non-leap year February 29', () => {
        expect(isValidDateFormat('2023-02-29')).toBe(false); // 2023 is not a leap year
        expect(isValidDateFormat('2021-02-29')).toBe(false); // 2021 is not a leap year
        expect(isValidDateFormat('1900-02-29')).toBe(false); // 1900 is not a leap year (divisible by 100 but not 400)
      });
    });

    describe('edge cases', () => {
      it('should handle year boundaries', () => {
        expect(isValidDateFormat('1000-01-01')).toBe(true);
        expect(isValidDateFormat('9999-12-31')).toBe(true);
        expect(isValidDateFormat('0001-01-01')).toBe(true);
      });

      it('should handle special leap year rules', () => {
        expect(isValidDateFormat('2100-02-29')).toBe(false); // Not a leap year (divisible by 100 but not 400)
        expect(isValidDateFormat('2400-02-29')).toBe(true); // Leap year (divisible by 400)
      });

      it('should reject dates with extra characters', () => {
        expect(isValidDateFormat('2024-01-15 ')).toBe(false); // Trailing space
        expect(isValidDateFormat(' 2024-01-15')).toBe(false); // Leading space
        expect(isValidDateFormat('2024-01-15Z')).toBe(false); // Timezone indicator
        expect(isValidDateFormat('2024-01-15\n')).toBe(false); // Newline
      });
    });
  });

  describe('getCurrentDate', () => {
    beforeEach(() => {
      jest.useFakeTimers({
        doNotFake: ['nextTick', 'setImmediate']
      });
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it('should return current date in YYYY-MM-DD format', () => {
      jest.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
      expect(getCurrentDate()).toBe('2024-01-15');
    });

    it('should handle different times of day', () => {
      jest.setSystemTime(new Date('2024-01-15T00:00:00.000Z'));
      expect(getCurrentDate()).toBe('2024-01-15');

      jest.setSystemTime(new Date('2024-01-15T23:59:59.999Z'));
      expect(getCurrentDate()).toBe('2024-01-15');
    });

    it('should handle different months and years', () => {
      jest.setSystemTime(new Date('2024-12-31T12:00:00.000Z'));
      expect(getCurrentDate()).toBe('2024-12-31');

      jest.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
      expect(getCurrentDate()).toBe('2025-01-01');
    });

    it('should handle leap years', () => {
      jest.setSystemTime(new Date('2024-02-29T12:00:00.000Z'));
      expect(getCurrentDate()).toBe('2024-02-29');
    });

    it('should pad single-digit months and days', () => {
      jest.setSystemTime(new Date('2024-01-05T12:00:00.000Z'));
      expect(getCurrentDate()).toBe('2024-01-05');

      jest.setSystemTime(new Date('2024-09-09T12:00:00.000Z'));
      expect(getCurrentDate()).toBe('2024-09-09');
    });
  });
});
