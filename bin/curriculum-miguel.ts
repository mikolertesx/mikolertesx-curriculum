#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { getEnvironmentConfig } from "../config/environments";
import { WebsiteStack } from "../lib/website-stack";

const app = new cdk.App();

// Select environment: npx cdk deploy -c env=prod
// Default is "dev" (also set in cdk.json context).
const envName = (app.node.tryGetContext("env") as string | undefined) ?? "dev";
const config = getEnvironmentConfig(envName);

// Optional one-off overrides (rarely needed if config/ is filled in):
//   npx cdk deploy -c env=dev -c bucketName=my-bucket
const bucketNameOverride = app.node.tryGetContext("bucketName") as
  | string
  | undefined;

new WebsiteStack(app, `CurriculumMiguelWebsite-${config.name}`, {
  env: {
    // Account is required for Route 53 hosted-zone lookup when domainName is set.
    account: config.account ?? process.env.CDK_DEFAULT_ACCOUNT,
    region: config.region ?? process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  },
  description: `Curriculum site (${config.name}): private S3 + CloudFront`,
  appEnv: config.name,
  bucketName: bucketNameOverride ?? config.bucketName,
  domainName: config.domainName,
  domainAliases: config.domainAliases,
  hostedZoneDomainName: config.hostedZoneDomainName,
  hostedZoneId: config.hostedZoneId,
  removalPolicy: config.removalPolicy,
  autoDeleteObjects: config.autoDeleteObjects,
  tags: {
    Project: "curriculum-miguel",
    Purpose: "static-website",
    Environment: config.name,
  },
});
