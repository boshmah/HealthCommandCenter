# Create Food Utils - Edge Cases Documentation

This document serves as a source of truth for all edge cases tested in the create-food utility functions. Each section corresponds to a helper function and lists the edge cases, the situation being tested, and the expected outcome.

## Table of Contents
- [calculateCalories](#calculatecalories)
- [parseMacronutrient](#parsemacronutrient)
- [isValidDateFormat](#isvaliddateformat)
- [getCurrentDate](#getcurrentdate)
- [validateFoodName](#validatefoodname)
- [validateFoodInput](#validatefoodinput)
- [generateFoodId](#generatefoodid)
- [createFoodEntity](#createfoodentity)
- [extractResponseData](#extractresponsedata)

## calculateCalories

### Edge Cases

| Edge Case | Situation | Expected Outcome |
|-----------|-----------|------------------|
| All zeros | `calculateCalories(0, 0, 0)` | Returns `0` |
| Decimal values | `calculateCalories(10.5, 20.25, 5.75)` | Returns `175` (rounds 174.75) |
| Very small decimals | `calculateCalories(0.01, 0.01, 0.01)` | Returns `0` (rounds 0.17) |
| Negative values | `calculateCalories(-10, -5, -2)` | Returns `-78` (handles negatives mathematically) |
| Very large values | `calculateCalories(9999, 9999, 9999)` | Returns `169983` |
| Mixed positive/negative | `calculateCalories(10, -5, 3)` | Returns `47` |
| Rounding at 0.5 | `calculateCalories(10.875, 0, 0)` | Returns `44` (rounds up from 43.5) |
| Rounding below 0.5 | `calculateCalories(10.1, 0, 0)` | Returns `40` (rounds down from 40.4) |

## parseMacronutrient

### Edge Cases

| Edge Case | Situation | Expected Outcome |
|-----------|-----------|------------------|
| Null value | `parseMacronutrient(null, 'Protein')` | Returns `0` |
| Undefined value | `parseMacronutrient(undefined, 'Carbs')` | Returns `0` |
| Empty string | `parseMacronutrient('', 'Fats')` | Returns `0` |
| Non-numeric string | `parseMacronutrient('abc', 'Protein')` | Returns `{ error: 'Invalid Protein value' }` |
| Object input | `parseMacronutrient({}, 'Carbs')` | Returns `{ error: 'Invalid Carbs value' }` |
| Array input | `parseMacronutrient([10], 'Fats')` | Returns `{ error: 'Invalid Fats value' }` |
| Boolean input | `parseMacronutrient(true, 'Protein')` | Returns `{ error: 'Invalid Protein value' }` |
| NaN value | `parseMacronutrient(NaN, 'Carbs')` | Returns `{ error: 'Invalid Carbs value' }` |
| Negative value | `parseMacronutrient(-5, 'Protein')` | Returns `{ error: 'Protein cannot be negative' }` |
| Value > 10000 | `parseMacronutrient(10001, 'Carbs')` | Returns `{ error: 'Carbs value is too large' }` |
| Boundary value (0) | `parseMacronutrient(0, 'Protein')` | Returns `0` |
| Boundary value (10000) | `parseMacronutrient(10000, 'Fats')` | Returns `10000` |
| Scientific notation | `parseMacronutrient('1e2', 'Protein')` | Returns `100` |
| Infinity | `parseMacronutrient(Infinity, 'Carbs')` | Returns `{ error: 'Carbs value is too large' }` |
| -Infinity | `parseMacronutrient(-Infinity, 'Fats')` | Returns `{ error: 'Fats cannot be negative' }` |
| String with spaces | `parseMacronutrient(' 10 ', 'Protein')` | Returns `10` (trims and parses) |
| Very small positive | `parseMacronutrient(0.00001, 'Carbs')` | Returns `0.00001` |

## isValidDateFormat

### Edge Cases

| Edge Case | Situation | Expected Outcome |
|-----------|-----------|------------------|
| Leap year date | `isValidDateFormat('2024-02-29')` | Returns `true` (2024 is leap year) |
| Non-leap year Feb 29 | `isValidDateFormat('2023-02-29')` | Returns `false` |
| Century non-leap year | `isValidDateFormat('1900-02-29')` | Returns `false` (divisible by 100, not by 400) |
| Century leap year | `isValidDateFormat('2000-02-29')` | Returns `true` (divisible by 400) |
| Wrong separator | `isValidDateFormat('2024/01/15')` | Returns `false` |
| Wrong date order | `isValidDateFormat('15-01-2024')` | Returns `false` (DD-MM-YYYY) |
| Missing leading zero | `isValidDateFormat('2024-1-15')` | Returns `false` |
| Month 0 | `isValidDateFormat('2024-00-15')` | Returns `false` |
| Month 13 | `isValidDateFormat('2024-13-01')` | Returns `false` |
| Day 0 | `isValidDateFormat('2024-01-00')` | Returns `false` |
| Invalid month days | `isValidDateFormat('2024-04-31')` | Returns `false` (April has 30 days) |
| February 30 | `isValidDateFormat('2024-02-30')` | Returns `false` |
| Empty string | `isValidDateFormat('')` | Returns `false` |
| Null input | `isValidDateFormat(null)` | Returns `false` |
| Number input | `isValidDateFormat(123)` | Returns `false` |
| ISO with time | `isValidDateFormat('2024-01-15T00:00:00')` | Returns `false` |
| Extra characters | `isValidDateFormat('2024-01-15 ')` | Returns `false` (trailing space) |
| Year boundaries | `isValidDateFormat('9999-12-31')` | Returns `true` |
| Very early year | `isValidDateFormat('0001-01-01')` | Returns `true` |

## getCurrentDate

### Edge Cases

| Edge Case | Situation | Expected Outcome |
|-----------|-----------|------------------|
| Midnight UTC | System time: `2024-01-15T00:00:00.000Z` | Returns `'2024-01-15'` |
| End of day UTC | System time: `2024-01-15T23:59:59.999Z` | Returns `'2024-01-15'` |
| New Year | System time: `2025-01-01T00:00:00.000Z` | Returns `'2025-01-01'` |
| Leap day | System time: `2024-02-29T12:00:00.000Z` | Returns `'2024-02-29'` |
| Single digit padding | System time: `2024-01-05T12:00:00.000Z` | Returns `'2024-01-05'` (pads day) |

## validateFoodName

### Edge Cases

| Edge Case | Situation | Expected Outcome |
|-----------|-----------|------------------|
| Empty string | `validateFoodName('')` | Returns `{ error: 'Name is required' }` |
| Only whitespace | `validateFoodName('   ')` | Returns `{ error: 'Name is required' }` |
| Null input | `validateFoodName(null)` | Returns `{ error: 'Name is required' }` |
| Undefined input | `validateFoodName(undefined)` | Returns `{ error: 'Name is required' }` |
| Non-string type | `validateFoodName(123)` | Returns `{ error: 'Name is required' }` |
| Max length (200) | `validateFoodName('A'.repeat(200))` | Returns the string (valid) |
| Over max length | `validateFoodName('A'.repeat(201))` | Returns `{ error: 'Name is too long (max 200 characters)' }` |
| Special characters | `validateFoodName('Ben & Jerry\'s')` | Returns `'Ben & Jerry\'s'` |
| Emojis | `validateFoodName('🍕 Pizza')` | Returns `'🍕 Pizza'` |
| International chars | `validateFoodName('Crème Brûlée')` | Returns `'Crème Brûlée'` |
| Chinese characters | `validateFoodName('北京烤鸭')` | Returns `'北京烤鸭'` |
| HTML tags | `validateFoodName('<script>alert("xss")</script>')` | Returns the string as-is (no execution) |
| SQL injection | `validateFoodName('Food\'; DROP TABLE foods; --')` | Returns the string as-is |
| Only special chars | `validateFoodName('!!!')` | Returns `'!!!'` |
| Control characters | `validateFoodName('Food\0Name')` | Returns `'Food\0Name'` (with null char) |
| Whitespace trimming | `validateFoodName('  Trimmed Name  ')` | Returns `'Trimmed Name'` |
| Single character | `validateFoodName('A')` | Returns `'A'` |

## validateFoodInput

### Edge Cases

| Edge Case | Situation | Expected Outcome |
|-----------|-----------|------------------|
| Missing date | Input without date field | Uses current date |
| Empty name | `{ name: '', protein: 10, ...}` | Returns `{ success: false, error: 'Name is required' }` |
| String macros | `{ protein: '10.5', carbs: '20', ...}` | Parses to numbers successfully |
| Missing macros | `{ name: 'Food' }` (no macros) | All macros default to 0, calories = 0 |
| Null macros | `{ protein: null, carbs: null, ...}` | All macros default to 0 |
| Negative protein | `{ protein: -10, ...}` | Returns `{ success: false, error: 'Protein cannot be negative' }` |
| Invalid carbs | `{ carbs: 'invalid', ...}` | Returns `{ success: false, error: 'Invalid Carbs value' }` |
| Fats over limit | `{ fats: 15000, ...}` | Returns `{ success: false, error: 'Fats value is too large' }` |
| Invalid date | `{ date: '2024-13-01', ...}` | Returns `{ success: false, error: 'Invalid date format. Use YYYY-MM-DD' }` |
| Wrong date format | `{ date: '15/01/2024', ...}` | Returns `{ success: false, error: 'Invalid date format. Use YYYY-MM-DD' }` |
| All max values | All macros at 10000 | Calculates to 170000 calories |
| Decimal calories | Macros that calculate to .5 | Rounds correctly (e.g., 177.1 → 177) |
| Validation order | Multiple errors present | Returns first error (name → protein → carbs → fats → date) |
| Name trimming | `{ name: '  Trimmed Food  ', ...}` | Name is trimmed in output |

## generateFoodId

### Edge Cases

| Edge Case | Situation | Expected Outcome |
|-----------|-----------|------------------|
| UUID generation | Calling `generateFoodId()` | Returns `'food-[uuid]'` format |
| Uniqueness | Multiple calls | Each returns different ID |

## createFoodEntity

### Edge Cases

| Edge Case | Situation | Expected Outcome |
|-----------|-----------|------------------|
| No foodId provided | `createFoodEntity(userId, data)` | Generates new foodId automatically |
| With foodId | `createFoodEntity(userId, data, 'food-123')` | Uses provided foodId |
| PK format | Any valid input | PK is `'USER#[userId]'` |
| SK format | Date: 2024-01-15, timestamp: 1705320000000 | SK is `'DATE#2024-01-15#TIME#1705320000000#FOOD#[foodId]'` |
| Timestamps | Current time: 2024-01-15T12:00:00.000Z | Both createdAt and updatedAt set to ISO string |
| Entity type | Any valid input | entityType is always `'FOOD'` |

## extractResponseData

### Edge Cases

| Edge Case | Situation | Expected Outcome |
|-----------|-----------|------------------|
| Full entity | Complete FoodEntity object | Returns only public fields |
| Excluded fields | Entity with PK, SK, entityType, userId, timestamp | These fields are not in response |
| Included fields | All other entity fields | foodId, name, macros, calories, date, timestamps included |

## Summary

All helper functions in `create-food-utils.ts` have comprehensive test coverage including:
- Boundary value testing
- Null/undefined handling
- Type validation
- Error message verification
- Edge case scenarios
- Security considerations (XSS, SQL injection)
- Internationalization support
- Precision and rounding behavior

The tests ensure robust validation and error handling for all possible inputs to the food creation utilities.
