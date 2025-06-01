import { CustomMessageTriggerEvent, CustomMessageTriggerHandler } from 'aws-lambda';

/**
 * Cognito Custom Message Lambda Trigger
 * Customizes email messages for different user actions
 */
export const handler: CustomMessageTriggerHandler = async (event: CustomMessageTriggerEvent) => {
  console.log('Custom message trigger:', JSON.stringify({
    triggerSource: event.triggerSource,
    userPoolId: event.userPoolId,
    userName: event.userName,
    request: event.request,
  }, null, 2));

  const { triggerSource, request } = event;
  const { codeParameter, userAttributes } = request;
  const email = userAttributes.email;

  // Customize messages based on trigger source
  switch (triggerSource) {
    case 'CustomMessage_SignUp':
      // New user sign up verification
      event.response.emailSubject = 'Welcome to Health Command Center - Verify Your Account';
      event.response.emailMessage = `
        <h2>Welcome to Health Command Center!</h2>
        <p>Thank you for signing up. Please verify your email address to get started.</p>
        <p><strong>Your verification code is: ${codeParameter}</strong></p>
        <p>This code will expire in 24 hours.</p>
        <br>
        <p>Best regards,<br>The Health Command Center Team</p>
      `;
      break;

    case 'CustomMessage_ForgotPassword':
      // Password reset request
      event.response.emailSubject = 'Health Command Center - Password Reset Request';
      event.response.emailMessage = `
        <h2>Password Reset Request</h2>
        <p>We received a request to reset your password for your Health Command Center account.</p>
        <p><strong>Your password reset code is: ${codeParameter}</strong></p>
        <p>This code will expire in 1 hour.</p>
        <p>If you didn't request this password reset, please ignore this email.</p>
        <br>
        <p>Best regards,<br>The Health Command Center Team</p>
      `;
      break;

    case 'CustomMessage_ResendCode':
      // Resend verification code
      event.response.emailSubject = 'Health Command Center - New Verification Code';
      event.response.emailMessage = `
        <h2>New Verification Code</h2>
        <p>You requested a new verification code for your Health Command Center account.</p>
        <p><strong>Your new verification code is: ${codeParameter}</strong></p>
        <p>This code will expire in 24 hours.</p>
        <br>
        <p>Best regards,<br>The Health Command Center Team</p>
      `;
      break;

    case 'CustomMessage_UpdateUserAttribute':
      // Email update verification
      event.response.emailSubject = 'Health Command Center - Verify Email Update';
      event.response.emailMessage = `
        <h2>Verify Your New Email Address</h2>
        <p>You requested to update your email address for your Health Command Center account.</p>
        <p><strong>Your verification code is: ${codeParameter}</strong></p>
        <p>This code will expire in 1 hour.</p>
        <br>
        <p>Best regards,<br>The Health Command Center Team</p>
      `;
      break;

    case 'CustomMessage_VerifyUserAttribute':
      // Verify user attribute (usually email)
      event.response.emailSubject = 'Health Command Center - Verify Your Email';
      event.response.emailMessage = `
        <h2>Email Verification</h2>
        <p>Please verify your email address for your Health Command Center account.</p>
        <p><strong>Your verification code is: ${codeParameter}</strong></p>
        <p>This code will expire in 24 hours.</p>
        <br>
        <p>Best regards,<br>The Health Command Center Team</p>
      `;
      break;

    case 'CustomMessage_AdminCreateUser':
      // Admin created user with temporary password
      event.response.emailSubject = 'Welcome to Health Command Center - Account Created';
      event.response.emailMessage = `
        <h2>Your Health Command Center Account Has Been Created</h2>
        <p>An administrator has created an account for you.</p>
        <p><strong>Your temporary password is: ${codeParameter}</strong></p>
        <p>You will be required to change this password on your first login.</p>
        <br>
        <p>Best regards,<br>The Health Command Center Team</p>
      `;
      break;

    default:
      // Use default message for any other trigger sources
      console.log(`Unhandled trigger source: ${triggerSource}`);
  }

  // Return the modified event
  return event;
};
