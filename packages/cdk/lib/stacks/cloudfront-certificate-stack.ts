import * as cdk from 'aws-cdk-lib';
import { aws_certificatemanager as acm } from 'aws-cdk-lib';
import { aws_route53 as route53 } from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

/**
 * Properties for the CloudFrontCertificateStack.
 */
export interface CloudFrontCertificateStackProps extends cdk.StackProps {
  /**
   * The domain name for which the certificate will be created (e.g., example.com).
   */
  readonly domainName: string;
}

/**
 * CloudFront Certificate Stack for Health Command Center
 * 
 * This stack MUST be deployed to us-east-1 region as CloudFront requires
 * certificates to be in us-east-1.
 * 
 * Deploy with: pnpm cdk deploy CloudFrontCertificateStack --region us-east-1
 * 
 * @class CloudFrontCertificateStack
 * @extends {cdk.Stack}
 * 
 * Purpose:
 * - Creates SSL/TLS certificate for CloudFront distribution
 * - Must be in us-east-1 (CloudFront requirement)
 * - Stores certificate ARN in Parameter Store for cross-region access
 * 
 * Cost Considerations:
 * - SSL Certificates: FREE (AWS Certificate Manager)
 * - Parameter Store: FREE for standard parameters
 * 
 * Deployment Order:
 * 1. Deploy this stack FIRST (in us-east-1)
 * 2. Then deploy DomainStack (in us-west-2)
 * 3. Then other stacks can reference the certificate
 */
export class CloudFrontCertificateStack extends cdk.Stack {
  /**
   * SSL certificate for CloudFront (must be in us-east-1)
   */
  public readonly certificate: acm.Certificate;

  constructor(scope: Construct, id: string, props: CloudFrontCertificateStackProps) {
    super(scope, id, {
      ...props,
      env: {
        ...props.env,
        region: 'us-east-1', // Force us-east-1 region
      },
    });

    const domainName = props.domainName;
    const wwwDomainName = `www.${domainName}`;

    /**
     * Look up existing hosted zone
     * 
     * Even though we're in us-east-1, Route 53 is a global service
     * so we can still look up the hosted zone.
     */
    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: domainName,
    });

    /**
     * Create SSL certificate for CloudFront
     * 
     * This certificate MUST be in us-east-1 for CloudFront to use it.
     * It covers:
     * - apex domain (healthcommandcenter.io)
     * - www subdomain (www.healthcommandcenter.io)
     * - wildcard (*.healthcommandcenter.io) for future flexibility
     */
    this.certificate = new acm.Certificate(this, 'CloudFrontCertificate', {
      domainName: domainName,
      subjectAlternativeNames: [
        wwwDomainName,
        `*.${domainName}`,
      ],
      validation: acm.CertificateValidation.fromDns(hostedZone),
      certificateName: 'HealthCommandCenter-CloudFront-Certificate',
    });

    /**
     * Store certificate ARN in Parameter Store
     * 
     * This allows the CloudFront stack in us-west-2 to reference
     * this certificate ARN without cross-stack dependencies.
     * 
     * NOTE: Parameter Store parameters are region-specific, but we can
     * read across regions using the full ARN or by specifying the region.
     */
    new ssm.StringParameter(this, 'CloudFrontCertificateArnParameter', {
      parameterName: '/health-command-center/cloudfront-certificate-arn',
      stringValue: this.certificate.certificateArn,
      description: 'CloudFront SSL certificate ARN (us-east-1)',
    });

    /**
     * Also store in us-west-2 for easier access
     * This creates a cross-region parameter reference
     */
    new cdk.CfnOutput(this, 'CertificateArn', {
      value: this.certificate.certificateArn,
      description: 'CloudFront SSL Certificate ARN - Copy this to use in us-west-2',
      exportName: 'HealthCommandCenter-CloudFront-Certificate-Arn',
    });

    /**
     * Validation Status Output
     */
    new cdk.CfnOutput(this, 'ValidationStatus', {
      value: 'Check AWS Console to ensure certificate is validated. This can take up to 30 minutes.',
      description: 'Certificate validation reminder',
    });

    /**
     * Deployment Instructions
     */
    new cdk.CfnOutput(this, 'NextSteps', {
      value: 'After this certificate is validated, you can deploy the other stacks in us-west-2',
      description: 'Next deployment steps',
    });

    // Tag all resources for cost tracking and organization
    cdk.Tags.of(this).add('Application', 'HealthCommandCenter');
    cdk.Tags.of(this).add('Stack', 'CloudFrontCertificate');
    cdk.Tags.of(this).add('Region', 'us-east-1');
  }
}
