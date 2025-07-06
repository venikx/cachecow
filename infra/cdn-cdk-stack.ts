import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import * as cf_origins from "aws-cdk-lib/aws-cloudfront-origins";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";

export class CdnCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const cdnOriginalsBucket = new s3.Bucket(this, "BaboCdnOriginalsBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // TODO(Kevin): Don't use this in prod
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const cdnTransformedBucket = new s3.Bucket(
      this,
      "BaboCdnTransformedBucket",
      {
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        publicReadAccess: false,
        encryption: s3.BucketEncryption.S3_MANAGED,
        enforceSSL: true,
        // TODO(Kevin): Don't use this in prod
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
      },
    );

    const distribution = new cf.Distribution(this, "BaboCdnDistribution", {
      comment: "optimized cdn assets",
      defaultBehavior: {
        origin:
          cf_origins.S3BucketOrigin.withOriginAccessControl(cdnOriginalsBucket),
      },
    });

    new cdk.CfnOutput(this, "CFDistributionId", {
      value: distribution.distributionDomainName,
    });
  }
}
