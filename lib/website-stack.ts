import * as path from "path";
import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import type { AppEnvironment } from "../config/environments";

export interface WebsiteStackProps extends cdk.StackProps {
  readonly appEnv: AppEnvironment;
  /** Optional explicit bucket name. Must be globally unique. */
  readonly bucketName?: string;
  /** Primary custom domain (e.g. miguel-gro.click). */
  readonly domainName?: string;
  /** Extra names covered by the cert and DNS (e.g. www.…). */
  readonly domainAliases?: string[];
  /** Route 53 zone name for validation + alias records. */
  readonly hostedZoneDomainName?: string;
  /** Optional explicit hosted zone ID (avoids Route 53 lookup). */
  readonly hostedZoneId?: string;
  readonly removalPolicy: cdk.RemovalPolicy;
  readonly autoDeleteObjects: boolean;
}

/**
 * Private S3 bucket + CloudFront distribution for static site hosting.
 *
 * Traffic path:
 *   Browser  --HTTPS-->  CloudFront  --OAC-->  S3 (private)
 * Optional custom domain:
 *   DNS (Route 53) → CloudFront, cert from ACM (us-east-1 for CloudFront)
 */
export class WebsiteStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly websiteUrl: string;

  constructor(scope: Construct, id: string, props: WebsiteStackProps) {
    super(scope, id, props);

    this.bucket = new s3.Bucket(this, "WebsiteBucket", {
      bucketName: props.bucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      versioned: true,
      removalPolicy: props.removalPolicy,
      autoDeleteObjects: props.autoDeleteObjects,
    });

    const siteDomain = props.domainName;
    const domainAliases = props.domainAliases ?? [];
    const allDomains = siteDomain ? [siteDomain, ...domainAliases] : [];

    let certificate: acm.ICertificate | undefined;
    let zone: route53.IHostedZone | undefined;

    if (siteDomain) {
      if (!props.hostedZoneDomainName && !props.hostedZoneId) {
        throw new Error(
          "domainName is set but hostedZoneDomainName (or hostedZoneId) is missing. " +
            "Custom domains need a Route 53 public hosted zone for ACM DNS validation and alias records.",
        );
      }

      // CloudFront requires the ACM certificate in us-east-1.
      if (cdk.Stack.of(this).region !== "us-east-1") {
        throw new Error(
          "This stack must deploy in us-east-1 when using a custom domain with CloudFront " +
            "(ACM certs for CloudFront are only accepted from us-east-1).",
        );
      }

      zone = props.hostedZoneId
        ? route53.HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
            hostedZoneId: props.hostedZoneId,
            zoneName: props.hostedZoneDomainName ?? siteDomain,
          })
        : route53.HostedZone.fromLookup(this, "HostedZone", {
            domainName: props.hostedZoneDomainName!,
          });

      certificate = new acm.Certificate(this, "SiteCertificate", {
        domainName: siteDomain,
        subjectAlternativeNames: domainAliases.length > 0 ? domainAliases : undefined,
        validation: acm.CertificateValidation.fromDns(zone),
      });
    }

    this.distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: `curriculum-miguel (${props.appEnv})`,
      defaultRootObject: "index.html",
      domainNames: allDomains.length > 0 ? allDomains : undefined,
      certificate,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 404,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 404,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.minutes(5),
        },
      ],
    });

    // Apex + aliases → CloudFront (IPv4 + IPv6)
    if (zone && allDomains.length > 0) {
      for (const hostname of allDomains) {
        const recordName =
          hostname === zone.zoneName
            ? undefined // apex
            : hostname.replace(new RegExp(`\\.${zone.zoneName.replace(/\./g, "\\.")}$`), "");

        const idSuffix = hostname.replace(/\./g, "-");

        new route53.ARecord(this, `AliasA-${idSuffix}`, {
          zone,
          recordName,
          target: route53.RecordTarget.fromAlias(
            new targets.CloudFrontTarget(this.distribution),
          ),
        });

        new route53.AaaaRecord(this, `AliasAAAA-${idSuffix}`, {
          zone,
          recordName,
          target: route53.RecordTarget.fromAlias(
            new targets.CloudFrontTarget(this.distribution),
          ),
        });
      }
    }

    new s3deploy.BucketDeployment(this, "DeployWebsite", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "..", "src"))],
      destinationBucket: this.bucket,
      distribution: this.distribution,
      distributionPaths: ["/*"],
      memoryLimit: 128,
    });

    this.websiteUrl = siteDomain
      ? `https://${siteDomain}`
      : `https://${this.distribution.distributionDomainName}`;

    new cdk.CfnOutput(this, "Environment", {
      description: "Deployment environment (dev|prod)",
      value: props.appEnv,
    });

    new cdk.CfnOutput(this, "BucketName", {
      description: "Name of the origin S3 bucket (private)",
      value: this.bucket.bucketName,
    });

    new cdk.CfnOutput(this, "BucketArn", {
      description: "ARN of the origin S3 bucket",
      value: this.bucket.bucketArn,
    });

    new cdk.CfnOutput(this, "DistributionId", {
      description: "CloudFront distribution ID",
      value: this.distribution.distributionId,
    });

    new cdk.CfnOutput(this, "DistributionDomainName", {
      description: "CloudFront domain (*.cloudfront.net)",
      value: this.distribution.distributionDomainName,
    });

    new cdk.CfnOutput(this, "WebsiteURL", {
      description: "Primary HTTPS URL for the site",
      value: this.websiteUrl,
    });

    if (siteDomain) {
      new cdk.CfnOutput(this, "CustomDomainNames", {
        description: "Custom domains attached to CloudFront",
        value: allDomains.join(", "),
      });
    }
  }
}
