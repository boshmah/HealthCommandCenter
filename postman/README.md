# Health Command Center - Auth Stack Testing

This Postman collection provides comprehensive testing for the Cognito authentication stack.

## Setup Instructions

1. **Import the Collection**
   - Open Postman
   - Click "Import" and select `HealthCommandCenter-Auth-Tests.postman_collection.json`

2. **Pre-configured Variables**
   - The collection comes pre-configured with the following values:
     - `userPoolId`: us-west-2_LyXz9fWYU
     - `clientId`: 6r3v1d00nj5osbsb29g60nt7cb
   - Other variables are automatically managed by the collection

3. **Verify Your Cognito Setup**
   ```bash
   # Your deployed auth stack should show these outputs:
   # AuthStack.UserPoolId = us-west-2_LyXz9fWYU
   # AuthStack.UserPoolClientId = 6r3v1d00nj5osbsb29g60nt7cb
   # AuthStack.UserPoolDomain = https://cognito-idp.us-west-2.amazonaws.com/us-west-2_LyXz9fWYU
   ```

## Running the Tests

### Full Test Suite
1. Click "Run collection" in Postman
2. The collection will automatically:
   - Generate a unique test email
   - Create a new user
   - Handle tokens between requests

### Manual Steps Required
- **Step 2 (Confirm Sign Up)**: Check your email for the verification code and update the `confirmationCode` variable before running
- **Step 6 (Forgot Password)**: If you test this, you'll need to check email for reset code

### Individual Tests
You can also run tests individually, but make sure to run them in order for the first time.

## Test Coverage

1. **Sign Up** - Creates new user with unique email
2. **Email Verification** - Confirms user email (manual code entry)
3. **Sign In** - Authenticates and receives tokens
4. **Get User Info** - Validates authenticated requests
5. **Token Refresh** - Tests refresh token flow
6. **Forgot Password** - Initiates password reset
7. **Sign Out** - Global sign out
8. **Invalid Login** - Validates error handling

## Variables Managed Automatically

- `testEmail` - Unique email generated for each run
- `username` - User's sub/ID from Cognito
- `accessToken` - JWT access token
- `idToken` - JWT ID token
- `refreshToken` - Refresh token
- `session` - Session token (if needed)

## Troubleshooting

### Email Not Received
- Check spam folder
- Verify your Cognito User Pool has email configured
- Check AWS SES sandbox restrictions

### Invalid Credentials Error
- Ensure password meets Cognito requirements:
  - At least 8 characters
  - Contains uppercase, lowercase, number, and symbol

### Token Expired
- Run the "Refresh Token" request
- Or run "Sign In" again for new tokens

## AWS Cost Considerations
- Cognito has a generous free tier (50,000 MAUs)
- Email verification uses AWS SES (minimal cost)
- No significant cost impact from testing
