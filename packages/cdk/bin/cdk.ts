#!/usr/bin/env node
import 'source-map-support/register.js';
import * as cdk from 'aws-cdk-lib';
import { DomainStack } from '../lib/stacks/domain-stack.js';
import { CloudFrontCertificateStack } from '../lib/stacks/cloudfront-certificate-stack.js';
import { AuthStack } from '../lib/stacks/auth-stack.js';

const app = new cdk.App();

const domainName = 'healthcommandcenter.io'; // Or from context/env

// Prioritize a custom environment variable for account ID, then fallback to CDK_DEFAULT_ACCOUNT
const account = process.env.MY_AWS_ACCOUNT_ID || process.env.CDK_DEFAULT_ACCOUNT;
const primaryRegion = 'us-west-2'; // Your primary deployment region
const cloudfrontCertRegion = 'us-east-1'; // ACM certificates for CloudFront must be in us-east-1

if (!account) {
  throw new Error(
    'Account ID not found. Please set MY_AWS_ACCOUNT_ID or ensure AWS CLI is configured for CDK_DEFAULT_ACCOUNT.'
  );
}

/**
 * Environment configurations
 */
const usEast1Env = {
  account: account,
  region: cloudfrontCertRegion, // For CloudFront certificates
};

const usWest2Env = {
  account: account,
  region: primaryRegion, 
};

/**
 * CloudFront Certificate Stack (MUST be deployed to us-east-1)
 * Deploy FIRST with: pnpm cdk deploy CloudFrontCertificateStack --region us-east-1
 */
const cloudfrontCertStack = new CloudFrontCertificateStack(app, 'CloudFrontCertificateStack', {
  domainName,
  env: usEast1Env, // Use the predefined env
  description: 'CloudFront SSL certificate for Health Command Center (us-east-1)',
});

/**
 * Domain Stack - Handles Route53 and regional certificates
 * Deploy SECOND with: pnpm cdk deploy DomainStack
 */
const domainStack = new DomainStack(app, 'DomainStack', {
  domainName,
  env: usWest2Env, // Use the predefined env
  description: 'Domain configuration for Health Command Center',
});

/**
 * Auth Stack - Cognito User Pools and authentication
 * Deploy THIRD with: pnpm cdk deploy AuthStack
 */
const authStack = new AuthStack(app, 'AuthStack', {
  env: usWest2Env, // Use the predefined env, now includes account
  description: 'Authentication infrastructure for Health Command Center',
});

// Add logical dependencies (doesn't affect parallel deployments)
authStack.addDependency(domainStack);

// Future stacks to be added:
// const apiStack = new ApiStack(app, 'ApiStack', { env: usWest2Env });
// apiStack.addDependency(authStack);

// const frontendStack = new FrontendStack(app, 'FrontendStack', { env: usWest2Env });
// frontendStack.addDependency(domainStack);

// const cloudFrontStack = new CloudFrontStack(app, 'CloudFrontStack', { env: usWest2Env });
// cloudFrontStack.addDependency(domainStack);
// cloudFrontStack.addDependency(frontendStack);
// cloudFrontStack.addDependency(apiStack);

// Tag all stacks with common tags
for (const construct of [cloudfrontCertStack, domainStack, authStack]) {
  cdk.Tags.of(construct).add('Application', 'HealthCommandCenter');
  cdk.Tags.of(construct).add('ManagedBy', 'CDK');
}

app.synth();