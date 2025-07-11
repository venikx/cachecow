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

    const optimizedBucket = new s3.Bucket(this, "CacheCowOptimizedBucket", {
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
        memorySize: 512,
        timeout: cdk.Duration.seconds(10),
        environment: {
          SOURCE_BUCKET: sourceBucket.bucketName,
          OPTIMIZED_BUCKET: optimizedBucket.bucketName,
        },
        bundling: {
          sourceMap: true,
          minify: false,
          target: "es2022",
          externalModules: [],
          // TODO(Kevin): add sharp to lambda layer
          nodeModules: ["sharp"],
        },
      },
    );

    sourceBucket.grantRead(imageFunction);
    optimizedBucket.grantReadWrite(imageFunction);

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
        origin: new cf_origins.OriginGroup({
          primaryOrigin:
            cf_origins.S3BucketOrigin.withOriginAccessControl(optimizedBucket),
          fallbackOrigin: new cf_origins.HttpOrigin(
            cdk.Fn.parseDomainName(imageFunctionUrl.url),
          ),
          fallbackStatusCodes: [403, 500, 503, 504],
        }),
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

    new cdk.CfnOutput(this, "TestUrl", {
      value: cdk.Fn.parseDomainName(imageFunctionUrl.url),
    });

    new cdk.CfnOutput(this, "CacheCowDistributionDomain", {
      value: distribution.distributionDomainName,
    });

    new cdk.CfnOutput(this, "ImageOptimizationUrl", {
      value: imageFunctionUrl.url,
    });
  }
}
