import { CustomMessageTriggerEvent, CustomMessageTriggerHandler } from 'aws-lambda';

/**
 * Custom Message Lambda for Cognito User Pool
 * 
 * This Lambda function customizes the emails sent by Amazon Cognito for user pool operations
 * such as sign-up verification, forgot password, etc.
 * 
 * @param {any} event - The event from Cognito containing message details
 * @returns {any} - The modified event with custom message content
 */
export const handler: CustomMessageTriggerHandler = async (event: CustomMessageTriggerEvent) => {
  console.log('Custom message trigger:', JSON.stringify({
    triggerSource: event.triggerSource,
    userPoolId: event.userPoolId,
    userName: event.userName,
    request: event.request,
  }, null, 2));

  // Make a copy of the event to avoid modifying the input directly
  const response = { ...event };
  
  try {
    // Different customization based on the trigger source
    switch (event.triggerSource) {
      case 'CustomMessage_SignUp':
        // Customize sign-up verification email
        response.response.emailSubject = 'Welcome to Health Command Center - Verify your email';
        response.response.emailMessage = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0066cc;">Welcome to Health Command Center!</h2>
            <p>Thank you for signing up. To complete your registration, please verify your email address.</p>
            <p>Your verification code is: <strong>${event.request.codeParameter}</strong></p>
            <p>This code will expire in 24 hours.</p>
            <p>If you didn't create this account, please ignore this email.</p>
          </div>
        `;
        break;
        
      case 'CustomMessage_ForgotPassword':
        // Customize forgot password email
        response.response.emailSubject = 'Health Command Center - Reset Your Password';
        response.response.emailMessage = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0066cc;">Password Reset Request</h2>
            <p>We received a request to reset your password for Health Command Center.</p>
            <p>Your verification code is: <strong>${event.request.codeParameter}</strong></p>
            <p>If you didn't request a password reset, please ignore this email or contact support.</p>
          </div>
        `;
        break;
        
      case 'CustomMessage_AdminCreateUser':
        // Customize admin invite email
        response.response.emailSubject = 'Welcome to Health Command Center';
        response.response.emailMessage = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0066cc;">You've been invited to Health Command Center!</h2>
            <p>An administrator has created an account for you.</p>
            <p>Your temporary password is: <strong>${event.request.codeParameter}</strong></p>
            <p>Please sign in and change your password as soon as possible.</p>
          </div>
        `;
        break;
        
      default:
        // No customization for other message types
        console.log(`No customization for trigger source: ${event.triggerSource}`);
    }
    
    console.log('Customized message successfully');
    return response;
  } catch (error) {
    console.error('Error customizing message:', error);
    // Return the original event in case of error to avoid blocking the flow
    return event;
  }
};
