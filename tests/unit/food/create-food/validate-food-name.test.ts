import { validateFoodName } from '../../../../packages/cdk/lib/lambdas/api/food/create-food/create-food-utils';

describe('validateFoodName', () => {
  describe('valid names', () => {
    it('should accept standard food names', () => {
      expect(validateFoodName('Chicken Breast')).toBe('Chicken Breast');
      expect(validateFoodName('Rice')).toBe('Rice');
      expect(validateFoodName('A')).toBe('A'); // Single character
    });

    it('should trim whitespace from names', () => {
      expect(validateFoodName('  Trimmed Name  ')).toBe('Trimmed Name');
      expect(validateFoodName('\tTabbed Name\t')).toBe('Tabbed Name');
      expect(validateFoodName('\nNewline Name\n')).toBe('Newline Name');
      expect(validateFoodName('   Multiple   Spaces   ')).toBe('Multiple   Spaces');
    });

    it('should accept names with special characters', () => {
      expect(validateFoodName('Chicken & Rice')).toBe('Chicken & Rice');
      expect(validateFoodName('Ben & Jerry\'s Ice Cream')).toBe('Ben & Jerry\'s Ice Cream');
      expect(validateFoodName('50% Lean Beef')).toBe('50% Lean Beef');
      expect(validateFoodName('Protein++ Shake')).toBe('Protein++ Shake');
      expect(validateFoodName('Café Latte')).toBe('Café Latte');
      expect(validateFoodName('Fish (Salmon)')).toBe('Fish (Salmon)');
      expect(validateFoodName('Pre-workout')).toBe('Pre-workout');
      expect(validateFoodName('Item #1')).toBe('Item #1');
      expect(validateFoodName('$5 Meal')).toBe('$5 Meal');
    });

    it('should accept names with emojis', () => {
      expect(validateFoodName('🍕 Pizza')).toBe('🍕 Pizza');
      expect(validateFoodName('Burger 🍔')).toBe('Burger 🍔');
      expect(validateFoodName('🥗 Salad 🥒')).toBe('🥗 Salad 🥒');
      expect(validateFoodName('😋 Yummy Food')).toBe('😋 Yummy Food');
    });

    it('should accept names with international characters', () => {
      expect(validateFoodName('Crème Brûlée')).toBe('Crème Brûlée');
      expect(validateFoodName('Pâté')).toBe('Pâté');
      expect(validateFoodName('Döner Kebab')).toBe('Döner Kebab');
      expect(validateFoodName('Phở')).toBe('Phở');
      expect(validateFoodName('北京烤鸭')).toBe('北京烤鸭'); // Beijing Duck in Chinese
      expect(validateFoodName('寿司')).toBe('寿司'); // Sushi in Japanese
    });

    it('should accept maximum length names', () => {
      const maxLengthName = 'A'.repeat(200);
      expect(validateFoodName(maxLengthName)).toBe(maxLengthName);
    });
  });

  describe('invalid names', () => {
    it('should reject empty names', () => {
      expect(validateFoodName('')).toEqual({ error: 'Name is required' });
      expect(validateFoodName('   ')).toEqual({ error: 'Name is required' }); // Only spaces
      expect(validateFoodName('\t\n\r')).toEqual({ error: 'Name is required' }); // Only whitespace
    });

    it('should reject null and undefined', () => {
      expect(validateFoodName(null)).toEqual({ error: 'Name is required' });
      expect(validateFoodName(undefined)).toEqual({ error: 'Name is required' });
    });

    it('should reject non-string types', () => {
      expect(validateFoodName(123)).toEqual({ error: 'Name is required' });
      expect(validateFoodName(true)).toEqual({ error: 'Name is required' });
      expect(validateFoodName(false)).toEqual({ error: 'Name is required' });
      expect(validateFoodName({})).toEqual({ error: 'Name is required' });
      expect(validateFoodName([])).toEqual({ error: 'Name is required' });
      expect(validateFoodName(() => {})).toEqual({ error: 'Name is required' });
    });

    it('should reject names exceeding maximum length', () => {
      const tooLongName = 'A'.repeat(201);
      expect(validateFoodName(tooLongName)).toEqual({ error: 'Name is too long (max 200 characters)' });
      
      const wayTooLongName = 'A'.repeat(1000);
      expect(validateFoodName(wayTooLongName)).toEqual({ error: 'Name is too long (max 200 characters)' });
    });
  });

  describe('security considerations', () => {
    it('should accept but not execute script tags', () => {
      const xssAttempt = '<script>alert("xss")</script>';
      expect(validateFoodName(xssAttempt)).toBe(xssAttempt); // Accepts as plain text
    });

    it('should accept HTML-like content as plain text', () => {
      expect(validateFoodName('<b>Bold Food</b>')).toBe('<b>Bold Food</b>');
      expect(validateFoodName('Food & <Drink>')).toBe('Food & <Drink>');
      expect(validateFoodName('A > B < C')).toBe('A > B < C');
    });

    it('should accept SQL-like content as plain text', () => {
      expect(validateFoodName('Food\'; DROP TABLE foods; --')).toBe('Food\'; DROP TABLE foods; --');
      expect(validateFoodName('1=1 OR 1=1')).toBe('1=1 OR 1=1');
    });
  });

  describe('edge cases', () => {
    it('should handle names with only special characters', () => {
      expect(validateFoodName('!!!')).toBe('!!!');
      expect(validateFoodName('...')).toBe('...');
      expect(validateFoodName('___')).toBe('___');
      expect(validateFoodName('@#$%')).toBe('@#$%');
    });

    it('should handle names with control characters', () => {
      expect(validateFoodName('Food\0Name')).toBe('Food\0Name'); // Null character
      expect(validateFoodName('Food\bName')).toBe('Food\bName'); // Backspace
      expect(validateFoodName('Food\x1BName')).toBe('Food\x1BName'); // Escape
    });

    it('should handle names at length boundaries', () => {
      const length199 = 'A'.repeat(199);
      const length200 = 'A'.repeat(200);
      const length201 = 'A'.repeat(201);

      expect(validateFoodName(length199)).toBe(length199);
      expect(validateFoodName(length200)).toBe(length200);
      expect(validateFoodName(length201)).toEqual({ error: 'Name is too long (max 200 characters)' });
    });

    it('should count emojis correctly for length validation', () => {
      const emojiName = '🍕'.repeat(100); // 100 pizza emojis
      // Some emojis might count as multiple characters
      if (emojiName.length <= 200) {
        expect(validateFoodName(emojiName)).toBe(emojiName);
      } else {
        expect(validateFoodName(emojiName)).toEqual({ error: 'Name is too long (max 200 characters)' });
      }
    });
  });
});
