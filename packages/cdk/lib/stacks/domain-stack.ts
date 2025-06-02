import * as cdk from 'aws-cdk-lib';
import { aws_route53 as route53 } from 'aws-cdk-lib';
import { aws_certificatemanager as acm } from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

/**
 * Properties for the DomainStack.
 */
export interface DomainStackProps extends cdk.StackProps {
  /**
   * The domain name to manage (e.g., example.com).
   */
  readonly domainName: string;
}

/**
 * Domain Stack for Health Command Center
 * 
 * Purpose:
 * - Manages the Route 53 Hosted Zone.
 * - Potentially creates regional SSL/TLS certificates if needed (not for CloudFront).
 * 
 * Cost Considerations:
 * - Route 53 Hosted Zone: $0.50 per month per hosted zone.
 * - Route 53 Queries: Costs vary based on query type and volume (typically low for small apps).
 * 
 * Deployment Order:
 * - Deploy CloudFrontCertificateStack (in us-east-1) first.
 * - Then deploy this stack (in your primary region, e.g., us-west-2).
 */
export class DomainStack extends cdk.Stack {
  /**
   * The Route 53 hosted zone for the domain
   * Used by other stacks to create DNS records
   */
  public readonly hostedZone: route53.IHostedZone;
  
  /**
   * SSL certificate for the domain (validated via DNS)
   * Used for regional services like API Gateway in us-west-2
   */
  public readonly certificate: acm.Certificate;

  constructor(scope: Construct, id: string, props: DomainStackProps) {
    super(scope, id, props);

    const domainName = props.domainName;
    const wwwDomainName = `www.${domainName}`;

    /**
     * Look up existing hosted zone
     * 
     * Since the domain was registered through AWS, a hosted zone
     * was automatically created. We'll reference it by domain name.
     * 
     * IMPORTANT: This lookup happens at synthesis time, not deployment time.
     * The AWS CLI must be configured with appropriate credentials when running 'cdk synth'.
     */
    this.hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: domainName,
    });

    /**
     * Create SSL certificate for the domain (in current region: us-west-2)
     * 
     * This certificate will be used for:
     * - API Gateway custom domain (if not using CloudFront for API)
     * - Any other regional services
     * 
     * DNS validation is used instead of email validation for automation.
     * ACM will create CNAME records that need to be added to Route 53.
     * Since we're using the same account, this happens automatically.
     */
    this.certificate = new acm.Certificate(this, 'RegionalCertificate', {
      domainName: domainName,
      subjectAlternativeNames: [
        wwwDomainName,
        `*.${domainName}`, // Wildcard for subdomains like api.healthcommandcenter.io
      ],
      validation: acm.CertificateValidation.fromDns(this.hostedZone),
      certificateName: 'HealthCommandCenter-Regional-Certificate',
    });

    /**
     * Store important values in Parameter Store
     * 
     * This allows other stacks to reference these values without
     * creating circular dependencies.
     * 
     * Parameter Store is preferred over exports for:
     * - Avoiding circular dependencies
     * - Easier updates without stack dependencies
     * - Can be accessed at runtime by applications
     */
    new ssm.StringParameter(this, 'DomainNameParameter', {
      parameterName: '/health-command-center/domain-name',
      stringValue: domainName,
      description: 'Primary domain name for Health Command Center',
    });

    new ssm.StringParameter(this, 'HostedZoneIdParameter', {
      parameterName: '/health-command-center/hosted-zone-id',
      stringValue: this.hostedZone.hostedZoneId,
      description: 'Route 53 Hosted Zone ID',
    });

    new ssm.StringParameter(this, 'RegionalCertificateArnParameter', {
      parameterName: '/health-command-center/regional-certificate-arn',
      stringValue: this.certificate.certificateArn,
      description: 'Regional SSL certificate ARN (us-west-2)',
    });

    /**
     * Stack Outputs
     * 
     * Export values that might be needed by other stacks or for reference
     * These can be viewed in the CloudFormation console or via CLI
     */
    new cdk.CfnOutput(this, 'DomainName', {
      value: domainName,
      description: 'Primary domain name',
      exportName: 'HealthCommandCenter-DomainName',
    });

    new cdk.CfnOutput(this, 'HostedZoneId', {
      value: this.hostedZone.hostedZoneId,
      description: 'Route 53 Hosted Zone ID',
      exportName: 'HealthCommandCenter-HostedZoneId',
    });

    new cdk.CfnOutput(this, 'RegionalCertificateArn', {
      value: this.certificate.certificateArn,
      description: 'Regional SSL Certificate ARN',
      exportName: 'HealthCommandCenter-RegionalCertificateArn',
    });

    /**
     * Important Note Output
     * Reminds developers about certificate validation timing
     */
    new cdk.CfnOutput(this, 'ImportantNote', {
      value: 'IMPORTANT: CloudFront certificates must be deployed separately in us-east-1. Run: pnpm cdk deploy CloudFrontCertificateStack --region us-east-1',
      description: 'Deployment notes',
    });

    // Tag all resources for cost tracking and organization
    cdk.Tags.of(this).add('Application', 'HealthCommandCenter');
    cdk.Tags.of(this).add('Stack', 'Domain');
  }
}
