import axios, { AxiosError, AxiosInstance } from 'axios';
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';
import { SSMClient, GetParameterCommand, GetParametersCommand } from '@aws-sdk/client-ssm';

describe('Create Food API Integration Test', () => {
  // SSM Parameter Store paths
  const SSM_CONFIG = {
    API_URL: '/hcc/apiGatewayUrl/prod',
    CLIENT_ID: '/hcc/cognito/clientID',
    TEST_EMAIL: '/hcc/integration/test_email',
    TEST_PASSWORD: '/hcc/integration/test_password'
  };
  
  const REGION = 'us-west-2';
  
  let AUTH_TOKEN: string;
  let axiosInstance: AxiosInstance;
  let API_URL: string;
  let CLIENT_ID: string;
  
  // Initialize AWS clients
  const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });
  const ssmClient = new SSMClient({ region: REGION });

  /**
   * Fetch parameter from SSM Parameter Store
   * @param parameterName - The name of the parameter to fetch
   * @param withDecryption - Whether to decrypt the parameter (for SecureString)
   * @returns The parameter value
   */
  async function getSSMParameter(parameterName: string, withDecryption: boolean = false): Promise<string> {
    try {
      const command = new GetParameterCommand({
        Name: parameterName,
        WithDecryption: withDecryption
      });
      
      const response = await ssmClient.send(command);
      
      if (!response.Parameter?.Value) {
        throw new Error(`Parameter ${parameterName} not found or has no value`);
      }
      
      return response.Parameter.Value;
    } catch (error) {
      console.error(`Failed to fetch SSM parameter ${parameterName}:`, error);
      throw error;
    }
  }

  /**
   * Fetch multiple parameters from SSM Parameter Store
   * @param parameters - Array of parameter configurations
   * @returns Map of parameter names to values
   */
  async function getSSMParameters(parameters: Array<{ name: string; withDecryption?: boolean }>): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    // Fetch parameters that don't need decryption in batch
    const plainParams = parameters.filter(p => !p.withDecryption);
    if (plainParams.length > 0) {
      const command = new GetParametersCommand({
        Names: plainParams.map(p => p.name),
        WithDecryption: false
      });
      
      const response = await ssmClient.send(command);
      response.Parameters?.forEach(param => {
        if (param.Name && param.Value) {
          results.set(param.Name, param.Value);
        }
      });
    }
    
    // Fetch encrypted parameters individually
    const encryptedParams = parameters.filter(p => p.withDecryption);
    for (const param of encryptedParams) {
      const value = await getSSMParameter(param.name, true);
      results.set(param.name, value);
    }
    
    return results;
  }

  /**
   * Authenticate and get token before running tests
   */
  beforeAll(async () => {
    // Create axios instance with custom config
    const http = await import('http');
    const https = await import('https');
    
    axiosInstance = axios.create({
      timeout: 10000,
      httpAgent: new http.Agent({ keepAlive: false }),
      httpsAgent: new https.Agent({ keepAlive: false })
    });

    try {
      console.log('Fetching configuration from SSM Parameter Store...');
      
      // Fetch all parameters
      const parameters = await getSSMParameters([
        { name: SSM_CONFIG.API_URL },
        { name: SSM_CONFIG.CLIENT_ID },
        { name: SSM_CONFIG.TEST_EMAIL },
        { name: SSM_CONFIG.TEST_PASSWORD, withDecryption: true }
      ]);
      
      // Extract values
      API_URL = parameters.get(SSM_CONFIG.API_URL)!;
      CLIENT_ID = parameters.get(SSM_CONFIG.CLIENT_ID)!;
      const testEmail = parameters.get(SSM_CONFIG.TEST_EMAIL)!;
      const testPassword = parameters.get(SSM_CONFIG.TEST_PASSWORD)!;
      
      console.log('✅ Successfully fetched configuration');
      console.log(`Using API URL: ${API_URL}`);
      console.log('Authenticating test user...');
      
      const command = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: {
          USERNAME: testEmail,
          PASSWORD: testPassword
        }
      });

      const response = await cognitoClient.send(command);
      
      if (!response.AuthenticationResult?.IdToken) {
        throw new Error('Failed to get authentication token');
      }
      
      AUTH_TOKEN = response.AuthenticationResult.IdToken;
      console.log('✅ Successfully authenticated test user');
    } catch (error) {
      console.error('Failed to authenticate:', error);
      throw error;
    }
  });

  /**
   * Clean up after all tests
   */
  afterAll(async () => {
    // Destroy the AWS clients to close connections
    cognitoClient.destroy();
    ssmClient.destroy();
    
    // Wait for any pending operations to complete
    await new Promise(resolve => setImmediate(resolve));
  });

  it('should create a food entry successfully', async () => {
    const testFood = {
      name: 'Integration Test Food',
      protein: 25,
      carbs: 30,
      fats: 10,
      date: new Date().toISOString().split('T')[0]
    };

    try {
      const response = await axiosInstance.post(
        `${API_URL}/foods`,
        testFood,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': AUTH_TOKEN
          }
        }
      );

      // Verify response status
      expect(response.status).toBe(201);

      // Verify response structure
      expect(response.data).toHaveProperty('foodId');
      expect(response.data).toHaveProperty('name', testFood.name);
      expect(response.data).toHaveProperty('protein', testFood.protein);
      expect(response.data).toHaveProperty('carbs', testFood.carbs);
      expect(response.data).toHaveProperty('fats', testFood.fats);
      expect(response.data).toHaveProperty('calories', 310);
      expect(response.data).toHaveProperty('date', testFood.date);
      expect(response.data).toHaveProperty('createdAt');
      expect(response.data).toHaveProperty('updatedAt');

      // Verify foodId format
      expect(response.data.foodId).toMatch(/^food-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

      console.log('✅ Food created successfully:', response.data.foodId);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        console.error('API Error:', {
          status: axiosError.response?.status,
          statusText: axiosError.response?.statusText,
          data: axiosError.response?.data,
          headers: axiosError.response?.headers
        });
      }
      throw error;
    }
  });

  it('should return 401 when no auth token is provided', async () => {
    const testFood = {
      name: 'Unauthorized Test Food',
      protein: 10,
      carbs: 20,
      fats: 5,
      date: new Date().toISOString().split('T')[0]
    };

    try {
      await axiosInstance.post(
        `${API_URL}/foods`,
        testFood,
        {
          headers: {
            'Content-Type': 'application/json'
            // No Authorization header
          }
        }
      );

      // Should not reach here
      fail('Expected request to fail with 401');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        expect(error.response?.status).toBe(401);
      } else {
        throw error;
      }
    }
  });

  it('should return 400 for invalid request body', async () => {
    const invalidFood = {
      // Missing required fields
      name: 'Invalid Test Food'
      // No protein, carbs, fats, or date
    };

    try {
      await axiosInstance.post(
        `${API_URL}/foods`,
        invalidFood,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': AUTH_TOKEN
          }
        }
      );

      // Should not reach here
      fail('Expected request to fail with 400');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        expect(error.response?.status).toBe(400);
        
        // Handle both possible error response formats
        const errorData = error.response?.data;
        expect(
          errorData.hasOwnProperty('error') || errorData.hasOwnProperty('message')
        ).toBe(true);
        
        // Verify there's an error message
        const errorMessage = errorData.error || errorData.message;
        expect(errorMessage).toBeTruthy();
        expect(typeof errorMessage).toBe('string');
      } else {
        throw error;
      }
    }
  });
});
