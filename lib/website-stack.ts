import * as path from "path";
import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";

export interface WebsiteStackProps extends cdk.StackProps {
  /**
   * Optional explicit bucket name. Must be globally unique.
   * If omitted, CloudFormation generates a unique name.
   */
  readonly bucketName?: string;
}

/**
 * Public S3 website hosting for the static files in /src.
 *
 * Note: S3 website endpoints are HTTP-only. Add CloudFront later for HTTPS.
 */
export class WebsiteStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly websiteUrl: string;

  constructor(scope: Construct, id: string, props?: WebsiteStackProps) {
    super(scope, id, props);

    this.bucket = new s3.Bucket(this, "WebsiteBucket", {
      bucketName: props?.bucketName,
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "index.html",
      // Public website via bucket policy; keep ACLs off.
      publicReadAccess: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      versioned: true,
      // Easy teardown while iterating (removes objects on stack delete).
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Upload ./src on every deploy (only changed files after first deploy).
    new s3deploy.BucketDeployment(this, "DeployWebsite", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "..", "src"))],
      destinationBucket: this.bucket,
      // Keep stack deploys from hanging on large trees; fine for a small site.
      memoryLimit: 128,
    });

    this.websiteUrl = this.bucket.bucketWebsiteUrl;

    new cdk.CfnOutput(this, "BucketName", {
      description: "Name of the website bucket",
      value: this.bucket.bucketName,
    });

    new cdk.CfnOutput(this, "BucketArn", {
      description: "ARN of the website bucket",
      value: this.bucket.bucketArn,
    });

    new cdk.CfnOutput(this, "WebsiteURL", {
      description:
        "S3 website endpoint (HTTP only). Open after deploy finishes.",
      value: this.bucket.bucketWebsiteUrl,
    });

    new cdk.CfnOutput(this, "WebsiteEndpoint", {
      description: "S3 website hostname (HTTP only, without scheme)",
      value: this.bucket.bucketWebsiteDomainName,
    });
  }
}
