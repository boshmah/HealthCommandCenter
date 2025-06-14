import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

// Mock crypto module completely
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(() => '123')  // Return just the ID part, handler will add 'food-' prefix
}));

// Mock DynamoDB Document Client
const ddbMock = mockClient(DynamoDBDocumentClient);

// Mock console methods
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

// Set TABLE_NAME environment variable before importing handler
process.env.TABLE_NAME = 'test-table';

// Import handler after setting environment variable
import { handler } from '../../../packages/cdk/lib/lambdas/api/food/create-food/index';

describe('Create Food Handler', () => {
  // Test constants
  const mockUserId = 'test-user-123';
  const mockFoodId = 'food-123';  // This is what the handler will produce
  const mockTableName = 'test-table';
  const mockContext = {} as Context;

  // Store original Date methods
  const originalDateNow = Date.now;
  const originalDateConstructor = global.Date;

  // Base event template
  const createMockEvent = (overrides?: Partial<APIGatewayProxyEvent>): APIGatewayProxyEvent => ({
    body: JSON.stringify({
      name: 'Chicken Breast',
      protein: 30,
      carbs: 0,
      fats: 3,
      date: '2024-01-15'
    }),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/foods',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      authorizer: {
        claims: {
          sub: mockUserId
        }
      },
      protocol: 'HTTP/1.1',
      httpMethod: 'POST',
      path: '/foods',
      stage: 'prod',
      requestId: 'request-id',
      requestTimeEpoch: 1234567890,
      resourceId: 'resource-id',
      resourcePath: '/foods',
      identity: {
        cognitoIdentityPoolId: null,
        accountId: null,
        cognitoIdentityId: null,
        caller: null,
        apiKey: null,
        sourceIp: '127.0.0.1',
        cognitoAuthenticationType: null,
        cognitoAuthenticationProvider: null,
        userArn: null,
        userAgent: 'Custom User Agent',
        user: null,
        accessKey: null,
        apiKeyId: null,
        clientCert: null,
        principalOrgId: null
      }
    },
    resource: '/foods',
    ...overrides
  });

  beforeEach(() => {
    jest.clearAllMocks();
    ddbMock.reset();
    
    // Don't clear console spies here - let them accumulate
    
    // Ensure TABLE_NAME is set
    process.env.TABLE_NAME = mockTableName;
    
    // Mock Date to return consistent values
    Date.now = jest.fn(() => 1705320000000);
    
    class MockDate extends originalDateConstructor {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super('2024-01-15T12:00:00.000Z');
        } else {
          // @ts-ignore - spreading args
          super(...(args as [any]));
        }
      }
      static now() {
        return 1705320000000;
      }
      
      getTime() {
        if (this.toISOString() === '2024-01-15T12:00:00.000Z') {
          return 1705320000000;
        }
        return super.getTime();
      }
    }
    
    // @ts-ignore - mocking global Date
    global.Date = MockDate as any;
    
    // Do NOT clear console spies here - they need to accumulate calls
  });

  afterEach(() => {
    // Restore Date methods
    Date.now = originalDateNow;
    global.Date = originalDateConstructor;
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Successful Food Creation', () => {
    it('should create food entry with all macronutrients', async () => {
      ddbMock.on(PutCommand).resolves({});

      const event = createMockEvent();
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body).toEqual({
        foodId: mockFoodId,
        name: 'Chicken Breast',
        protein: 30,
        carbs: 0,
        fats: 3,
        calories: 147, // (30*4) + (0*4) + (3*9) = 147
        date: '2024-01-15',
        createdAt: '2024-01-15T12:00:00.000Z',
        updatedAt: '2024-01-15T12:00:00.000Z'
      });

      const putCall = ddbMock.commandCalls(PutCommand)[0];
      expect(putCall.args[0].input).toMatchObject({
        TableName: mockTableName,
        Item: {
          PK: `USER#${mockUserId}`,
          SK: `DATE#2024-01-15#TIME#1705320000000#FOOD#${mockFoodId}`,  // Fixed timestamp
          entityType: 'FOOD',
          foodId: mockFoodId,
          userId: mockUserId,
          date: '2024-01-15',
          timestamp: 1705320000000,  // Fixed timestamp
          name: 'Chicken Breast',
          protein: 30,
          carbs: 0,
          fats: 3,
          calories: 147,
          createdAt: '2024-01-15T12:00:00.000Z',
          updatedAt: '2024-01-15T12:00:00.000Z'
        },
        ConditionExpression: 'attribute_not_exists(PK)'
      });
    });

    it('should calculate calories correctly for different macronutrient combinations', async () => {
      ddbMock.on(PutCommand).resolves({});

      const testCases = [
        { protein: 0, carbs: 0, fats: 0, expectedCalories: 0 },
        { protein: 25, carbs: 30, fats: 10, expectedCalories: 310 }, // (25*4) + (30*4) + (10*9)
        { protein: 50, carbs: 0, fats: 0, expectedCalories: 200 },
        { protein: 0, carbs: 100, fats: 0, expectedCalories: 400 },
        { protein: 0, carbs: 0, fats: 20, expectedCalories: 180 },
        { protein: 40.5, carbs: 60.25, fats: 15.75, expectedCalories: 545 } // Decimals: (40.5*4) + (60.25*4) + (15.75*9) = 162 + 241 + 141.75 = 544.75 ≈ 545
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();
        ddbMock.reset();
        ddbMock.on(PutCommand).resolves({});

        const event = createMockEvent({
          body: JSON.stringify({
            name: 'Test Food',
            protein: testCase.protein,
            carbs: testCase.carbs,
            fats: testCase.fats,
            date: '2024-01-15'
          })
        });

        const result = await handler(event, mockContext);
        const body = JSON.parse(result.body);
        
        expect(result.statusCode).toBe(201);
        expect(body.calories).toBe(testCase.expectedCalories);
      }
    });
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 when user ID is missing from authorizer', async () => {
      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            claims: {}
          }
        }
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body)).toEqual({ error: 'Unauthorized' });
      expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
    });

    it('should return 401 when authorizer is null', async () => {
      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: null as any
        }
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body)).toEqual({ error: 'Unauthorized' });
    });

    it('should return 401 when authorizer claims are null', async () => {
      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            claims: null as any
          }
        }
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body)).toEqual({ error: 'Unauthorized' });
    });
  });

  describe('Request Validation', () => {
    it('should return 400 when request body is missing', async () => {
      const event = createMockEvent({ body: null });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toEqual({ error: 'Request body is required' });
      expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
    });

    it('should return 400 when request body is empty string', async () => {
      const event = createMockEvent({ body: '' });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toEqual({ error: 'Request body is required' });
    });

    it('should return 400 when request body is invalid JSON', async () => {
      const event = createMockEvent({ body: 'invalid json' });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toEqual({ error: 'Invalid request body' });
    });

    it('should handle missing required fields gracefully', async () => {
      const invalidPayloads = [
        { protein: 30, carbs: 0, fats: 3, date: '2024-01-15' }, // missing name
        { name: '', protein: 30, carbs: 0, fats: 3, date: '2024-01-15' }, // empty name
        { name: '   ', protein: 30, carbs: 0, fats: 3, date: '2024-01-15' }, // whitespace name
        { name: 'Test', carbs: 0, fats: 3, date: '2024-01-15' }, // missing protein
        { name: 'Test', protein: 30, fats: 3, date: '2024-01-15' }, // missing carbs
        { name: 'Test', protein: 30, carbs: 0, date: '2024-01-15' }, // missing fats
        { name: 'Test', protein: 30, carbs: 0, fats: 3 }, // missing date
      ];

      for (const payload of invalidPayloads) {
        jest.clearAllMocks();
        ddbMock.reset();
        ddbMock.on(PutCommand).resolves({});

        const event = createMockEvent({ body: JSON.stringify(payload) });
        const result = await handler(event, mockContext);

        if (!payload.name || payload.name.trim() === '') {
          expect(result.statusCode).toBe(400);
          expect(JSON.parse(result.body)).toEqual({ error: 'Name is required' });
        } else {
          expect(result.statusCode).toBe(201);
          const body = JSON.parse(result.body);
          // When macros are missing, they default to 0
          expect(body.protein).toBe(payload.protein || 0);
          expect(body.carbs).toBe(payload.carbs || 0);
          expect(body.fats).toBe(payload.fats || 0);
        }
      }
    });

    it('should handle negative macronutrient values', async () => {
      ddbMock.on(PutCommand).resolves({});

      const event = createMockEvent({
        body: JSON.stringify({
          name: 'Test Food',
          protein: -10,
          carbs: -5,
          fats: -2,
          date: '2024-01-15'
        })
      });

      const result = await handler(event, mockContext);

      // Current implementation doesn't validate negative values
      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.calories).toBe(-78); // (-10*4) + (-5*4) + (-2*9) = -78
    });

    it('should handle extremely large macronutrient values', async () => {
      ddbMock.on(PutCommand).resolves({});

      const event = createMockEvent({
        body: JSON.stringify({
          name: 'Test Food',
          protein: 999999,
          carbs: 999999,
          fats: 999999,
          date: '2024-01-15'
        })
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.calories).toBe(16999983); // (999999*4) + (999999*4) + (999999*9)
    });

    it('should handle special characters in food name', async () => {
      ddbMock.on(PutCommand).resolves({});

      const specialNames = [
        'Chicken & Rice',
        'Ben & Jerry\'s Ice Cream',
        'Café Latte',
        '50% Lean Beef',
        'Protein++ Shake',
        '🍕 Pizza',
        '<script>alert("xss")</script>',
        'Food\nWith\nNewlines',
        'Food\tWith\tTabs'
      ];

      for (const name of specialNames) {
        jest.clearAllMocks();
        ddbMock.reset();
        ddbMock.on(PutCommand).resolves({});

        const event = createMockEvent({
          body: JSON.stringify({
            name,
            protein: 10,
            carbs: 10,
            fats: 10,
            date: '2024-01-15'
          })
        });

        const result = await handler(event, mockContext);

        if (name.trim() === '') {
          expect(result.statusCode).toBe(400);
          expect(JSON.parse(result.body)).toEqual({ error: 'Name is required' });
        } else {
          expect(result.statusCode).toBe(201);
          const body = JSON.parse(result.body);
          expect(body.name).toBe(name);
        }
      }
    });

    it('should handle various date formats', async () => {
      const dates = [
        '2024-01-15',
        '2024-12-31',
        '2024-02-29', // Leap year
        '2023-02-28',
        '2024-01-01',
        '2025-06-15'
      ];

      for (const date of dates) {
        jest.clearAllMocks();
        ddbMock.reset();
        ddbMock.on(PutCommand).resolves({});

        const event = createMockEvent({
          body: JSON.stringify({
            name: 'Test Food',
            protein: 10,
            carbs: 10,
            fats: 10,
            date
          })
        });

        const result = await handler(event, mockContext);

        expect(result.statusCode).toBe(201);
        const body = JSON.parse(result.body);
        expect(body.date).toBe(date);
      }
    });

    it('should handle invalid date formats', async () => {
      ddbMock.on(PutCommand).resolves({});

      const invalidDates = [
        '2024-13-01', // Invalid month
        '2024-01-32', // Invalid day
        '15-01-2024', // Wrong format
        'not-a-date',
        '2024/01/15', // Wrong separator
        '2024-1-15',  // Missing leading zeros
        ''
      ];

      for (const date of invalidDates) {
        jest.clearAllMocks();
        ddbMock.reset();
        ddbMock.on(PutCommand).resolves({});

        const event = createMockEvent({
          body: JSON.stringify({
            name: 'Test Food',
            protein: 10,
            carbs: 10,
            fats: 10,
            date
          })
        });

        const result = await handler(event, mockContext);

        // Current implementation doesn't validate date format
        expect(result.statusCode).toBe(201);
      }
    });
  });

  describe('DynamoDB Interactions', () => {
    it('should handle DynamoDB put failures', async () => {
      // Clear console spies at the start of this specific test
      consoleLogSpy.mockClear();
      consoleErrorSpy.mockClear();
      
      const error = new Error('DynamoDB error');
      ddbMock.on(PutCommand).rejects(error);

      const event = createMockEvent();
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toEqual({ error: 'Internal server error' });
      
      // Check both console logs were called
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Create food request:', 
        expect.any(String)
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error creating food:', error);
    });

    it('should handle conditional check failures (duplicate key)', async () => {
      const conditionalError = new Error('The conditional request failed');
      (conditionalError as any).name = 'ConditionalCheckFailedException';
      ddbMock.on(PutCommand).rejects(conditionalError);

      const event = createMockEvent();
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(409);
      expect(JSON.parse(result.body)).toEqual({ error: 'Food item already exists' });
    });

    it('should handle DynamoDB throttling', async () => {
      const throttleError = new Error('Throughput exceeded');
      (throttleError as any).name = 'ProvisionedThroughputExceededException';
      ddbMock.on(PutCommand).rejects(throttleError);

      const event = createMockEvent();
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(503);
      expect(JSON.parse(result.body)).toEqual({ error: 'Service temporarily unavailable' });
    });

    it('should handle missing TABLE_NAME environment variable', async () => {
      // Clear console spies at the start of this specific test
      consoleLogSpy.mockClear();
      consoleErrorSpy.mockClear();
      
      // Store original value
      const originalTableName = process.env.TABLE_NAME;
      
      // Clear modules and environment
      delete process.env.TABLE_NAME;
      jest.resetModules();
      
      // Mock crypto again for the fresh import
      jest.doMock('crypto', () => ({
        ...jest.requireActual('crypto'),
        randomUUID: jest.fn(() => '123')
      }));
      
      // Re-import handler without TABLE_NAME
      const freshModule = await import('../../../packages/cdk/lib/lambdas/api/food/create-food/index');
      const freshHandler = freshModule.handler;

      const event = createMockEvent();
      const result = await freshHandler(event, mockContext);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toEqual({ error: 'Internal server error' });
      
      // Check console logs
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Create food request:', 
        expect.any(String)
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'TABLE_NAME environment variable is not set'
      );

      // Restore original value
      process.env.TABLE_NAME = originalTableName;
      
      // Clean up the mock
      jest.dontMock('crypto');
    });
  });

  describe('Edge Cases and Boundaries', () => {
    it('should handle maximum string lengths', async () => {
      ddbMock.on(PutCommand).resolves({});

      const longName = 'A'.repeat(1000); // 1000 character name
      const event = createMockEvent({
        body: JSON.stringify({
          name: longName,
          protein: 10,
          carbs: 10,
          fats: 10,
          date: '2024-01-15'
        })
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.name).toBe(longName);
    });

    it('should handle decimal macronutrient values', async () => {
      ddbMock.on(PutCommand).resolves({});

      const event = createMockEvent({
        body: JSON.stringify({
          name: 'Test Food',
          protein: 10.5,
          carbs: 20.25,
          fats: 5.75,
          date: '2024-01-15'
        })
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.protein).toBe(10.5);
      expect(body.carbs).toBe(20.25);
      expect(body.fats).toBe(5.75);
      expect(body.calories).toBe(175); // (10.5*4) + (20.25*4) + (5.75*9) = 42 + 81 + 51.75 = 174.75 rounds to 175
    });

    it('should handle string numbers for macronutrients', async () => {
      ddbMock.on(PutCommand).resolves({});

      const event = createMockEvent({
        body: JSON.stringify({
          name: 'Test Food',
          protein: '30',
          carbs: '40',
          fats: '10',
          date: '2024-01-15'
        })
      });

      const result = await handler(event, mockContext);

      // TypeScript would normally catch this, but testing runtime behavior
      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      // String multiplication in JavaScript converts to number
      expect(body.calories).toBe(370); // (30*4) + (40*4) + (10*9)
    });

    it('should handle null/undefined macronutrient values', async () => {
      ddbMock.on(PutCommand).resolves({});

      const event = createMockEvent({
        body: JSON.stringify({
          name: 'Test Food',
          protein: null,
          carbs: undefined,
          fats: null,
          date: '2024-01-15'
        })
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.calories).toBe(0); // null/undefined values should result in 0 calories
    });

    it('should handle concurrent requests with same timestamp', async () => {
      ddbMock.on(PutCommand).resolves({});

      // Simulate two requests at the exact same millisecond
      const promises: Promise<APIGatewayProxyResult>[] = [];
      for (let i = 0; i < 2; i++) {
        const event = createMockEvent();
        promises.push(handler(event, mockContext));
      }

      const results = await Promise.all(promises);

      // Both should succeed since they have different food IDs
      results.forEach(result => {
        expect(result.statusCode).toBe(201);
      });

      // Verify both calls were made
      expect(ddbMock.commandCalls(PutCommand)).toHaveLength(2);
    });

    it('should handle very old and future dates', async () => {
      const dates = [
        '1900-01-01',
        '2099-12-31',
        '2000-01-01',
        '2024-02-29' // Leap year
      ];

      for (const date of dates) {
        jest.clearAllMocks();
        ddbMock.reset();
        ddbMock.on(PutCommand).resolves({});

        const event = createMockEvent({
          body: JSON.stringify({
            name: 'Test Food',
            protein: 10,
            carbs: 10,
            fats: 10,
            date
          })
        });

        const result = await handler(event, mockContext);

        expect(result.statusCode).toBe(201);
        const body = JSON.parse(result.body);
        expect(body.date).toBe(date);
      }
    });
  });

  describe('Response Format', () => {
    it('should return correct headers', async () => {
      ddbMock.on(PutCommand).resolves({});

      const event = createMockEvent();
      const result = await handler(event, mockContext);

      expect(result.headers).toMatchObject({ 
        'Content-Type': 'application/json' 
      });
    });

    it('should not expose sensitive information in responses', async () => {
      ddbMock.on(PutCommand).resolves({});

      const event = createMockEvent();
      const result = await handler(event, mockContext);

      const body = JSON.parse(result.body);
      
      // Should not include internal fields
      expect(body.PK).toBeUndefined();
      expect(body.SK).toBeUndefined();
      expect(body.entityType).toBeUndefined();
      expect(body.timestamp).toBeUndefined();
    });

    it('should log requests and responses appropriately', async () => {
      // Clear console spies at the start of this specific test
      consoleLogSpy.mockClear();
      consoleErrorSpy.mockClear();
      
      ddbMock.on(PutCommand).resolves({});

      const event = createMockEvent();
      await handler(event, mockContext);

      // Check that request was logged
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Create food request:', 
        expect.any(String)
      );
      
      // Check that success was logged
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Food created successfully:', 
        mockFoodId
      );
    });
  });
});
