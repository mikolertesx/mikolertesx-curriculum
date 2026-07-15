#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { WebsiteStack } from "../lib/website-stack";

const app = new cdk.App();

// Optional: pass a fixed bucket name via context, e.g.
//   npx cdk deploy -c bucketName=my-unique-bucket-name
const bucketName = app.node.tryGetContext("bucketName") as string | undefined;

new WebsiteStack(app, "CurriculumMiguelWebsiteStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  },
  description: "S3 static website for Miguel's curriculum / portfolio site",
  bucketName,
  tags: {
    Project: "curriculum-miguel",
    Purpose: "static-website",
  },
});
