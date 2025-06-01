#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DomainStack } from '../lib/stacks/domain-stack';
import { CloudFrontCertificateStack } from '../lib/stacks/cloudfront-certificate-stack';
import { AuthStack } from '../lib/stacks/auth-stack';

const app = new cdk.App();

/**
 * Environment configurations
 */
const usEast1Env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-east-1', // For CloudFront certificates
};

const usWest2Env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-west-2', // Main application region
};

/**
 * CloudFront Certificate Stack (MUST be deployed to us-east-1)
 * Deploy FIRST with: pnpm cdk deploy CloudFrontCertificateStack --region us-east-1
 */
const cloudfrontCertStack = new CloudFrontCertificateStack(app, 'CloudFrontCertificateStack', {
  env: usEast1Env,
  description: 'CloudFront SSL certificate for Health Command Center (us-east-1)',
});

/**
 * Domain Stack - Handles Route53 and regional certificates
 * Deploy SECOND with: pnpm cdk deploy DomainStack
 */
const domainStack = new DomainStack(app, 'DomainStack', {
  env: usWest2Env,
  description: 'Domain configuration for Health Command Center',
});

/**
 * Auth Stack - Cognito User Pools and authentication
 * Deploy THIRD with: pnpm cdk deploy AuthStack
 */
const authStack = new AuthStack(app, 'AuthStack', {
  env: usWest2Env,
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