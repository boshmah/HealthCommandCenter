#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AuthStack } from '../lib/stacks/auth-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-west-2',
};

// Domain stack will be created later
// new DomainStack(app, 'DomainStack', { env });

new AuthStack(app, 'AuthStack', {
  env,
  description: 'Health Command Center Authentication Stack',
});

// Future stacks
// new ApiStack(app, 'ApiStack', { env });
// new FrontendStack(app, 'FrontendStack', { env });
// new CloudFrontStack(app, 'CloudFrontStack', { env });

app.synth();
