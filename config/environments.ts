import * as cdk from "aws-cdk-lib";

/**
 * Logical deployment environments.
 * Select with: npx cdk deploy -c env=dev|prod
 */
export type AppEnvironment = "dev" | "prod";

export interface EnvironmentConfig {
  /** Short name used in stack IDs and tags */
  readonly name: AppEnvironment;
  /**
   * Optional fixed S3 bucket name (globally unique).
   * Leave undefined to let CloudFormation generate one.
   */
  readonly bucketName?: string;
  /**
   * Primary custom hostname for CloudFront (e.g. miguel-gro.click).
   * Requires a public Route 53 hosted zone (see hostedZoneDomainName).
   * Leave undefined to use only the default *.cloudfront.net URL.
   */
  readonly domainName?: string;
  /**
   * Extra hostnames on the same cert + distribution (e.g. www).
   */
  readonly domainAliases?: string[];
  /**
   * Route 53 public hosted zone name used for ACM DNS validation + alias records.
   * Usually the registered domain (e.g. miguel-gro.click).
   */
  readonly hostedZoneDomainName?: string;
  /**
   * Optional: pin the hosted zone by ID (Z…) instead of looking it up by name.
   * Prefer this in CI once you know the zone ID.
   */
  readonly hostedZoneId?: string;
  /** AWS account / region for this env (optional — falls back to CLI defaults) */
  readonly account?: string;
  readonly region: string;
  /** How the S3 bucket behaves on stack delete */
  readonly removalPolicy: cdk.RemovalPolicy;
  /** Delete bucket objects automatically when the stack is destroyed */
  readonly autoDeleteObjects: boolean;
}

/**
 * Per-environment settings. Edit these instead of passing long CLI flags.
 * Domain names and accounts are safe to commit (not secrets).
 */
export const environments: Record<AppEnvironment, EnvironmentConfig> = {
  dev: {
    name: "dev",
    region: "us-east-1",
    domainName: "miguel-gro.click",
    domainAliases: ["www.miguel-gro.click"],
    hostedZoneDomainName: "miguel-gro.click",
    // Pin zone ID so synth/deploy doesn't need a live Route 53 lookup (better for CI).
    hostedZoneId: "Z0470555Y26JDH40V9G6",
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
  },
  prod: {
    name: "prod",
    region: "us-east-1",
    // Point prod at a hostname when ready, e.g. same apex or a dedicated name.
    // domainName: "miguel-gro.click",
    // domainAliases: ["www.miguel-gro.click"],
    // hostedZoneDomainName: "miguel-gro.click",
    removalPolicy: cdk.RemovalPolicy.RETAIN,
    autoDeleteObjects: false,
  },
};

export function isAppEnvironment(value: string): value is AppEnvironment {
  return value === "dev" || value === "prod";
}

export function getEnvironmentConfig(envName: string): EnvironmentConfig {
  if (!isAppEnvironment(envName)) {
    throw new Error(
      `Unknown env "${envName}". Use one of: ${Object.keys(environments).join(", ")}`,
    );
  }
  return environments[envName];
}
