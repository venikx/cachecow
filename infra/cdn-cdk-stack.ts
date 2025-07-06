import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import * as cf_origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambda_node from "aws-cdk-lib/aws-lambda-nodejs";

export class CacheCowCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const sourceBucket = new s3.Bucket(this, "CacheCowSourceBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // TODO(Kevin): Don't use this in prod
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const cacheBucket = new s3.Bucket(this, "CacheCowCacheBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // TODO(Kevin): Don't use this in prod
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const imageFunction = new lambda_node.NodejsFunction(
      this,
      "ImageOptimizationFunction",
      {
        entry: "../functions/image-optimization/index.ts",
        runtime: lambda.Runtime.NODEJS_22_X,
        bundling: {
          sourceMap: true,
          minify: false,
          target: "es2022",
          // TODO(Kevin): add sharp to lambda layer
          externalModules: [],
          nodeModules: ["sharp"],
        },
      },
    );

    const imageFunctionUrl = imageFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [lambda.HttpMethod.GET],
        allowedHeaders: ["*"],
      },
    });

    const distribution = new cf.Distribution(this, "CacheCowDistribution", {
      defaultBehavior: {
        origin: cf_origins.S3BucketOrigin.withOriginAccessControl(sourceBucket),
        cachePolicy: cf.CachePolicy.CACHING_OPTIMIZED,
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: false,
        //functionAssociations: [
        //  {
        //    eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
        //    function: urlRewriteFunction,
        //  },
        //],
      },
    });

    new cdk.CfnOutput(this, "CacheCowDistributionDomain", {
      value: distribution.distributionDomainName,
    });

    new cdk.CfnOutput(this, "ImageOptimizationUrl", {
      value: imageFunctionUrl.url,
    });
  }
}
