import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import * as cf_origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambda_node from "aws-cdk-lib/aws-lambda-nodejs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as certificatemanager from "aws-cdk-lib/aws-certificatemanager";

interface CacheCowCdkStackProps extends cdk.StackProps {
  certificateArn: string;
}

export class CacheCowCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CacheCowCdkStackProps) {
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

    const cacheCowSecret = new secretsmanager.Secret(this, "CacheCowSecret", {
      secretName: "CacheCowSecretToken",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({}),
        generateStringKey: "token",
        excludePunctuation: true,
        includeSpace: false,
      },
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
          SECRET_ARN: cacheCowSecret.secretArn,
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
    cacheCowSecret.grantRead(imageFunction);

    const urlRewriteFunction = new cf.Function(this, "UrlRewriteFn", {
      code: cf.FunctionCode.fromFile({
        filePath: "../functions/url-rewrite/index.js",
      }),
      functionName: "UrlRewriteFunction",
    });

    const imageFunctionUrl = imageFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [lambda.HttpMethod.GET],
        allowedHeaders: ["*"],
      },
    });

    const certificate = certificatemanager.Certificate.fromCertificateArn(
      this,
      "ImportedCacheCowCert",
      props.certificateArn,
    );

    const distribution = new cf.Distribution(this, "CacheCowDistribution", {
      domainNames: ["cdn.babodigital.com"],
      certificate,
      defaultBehavior: {
        origin: new cf_origins.OriginGroup({
          primaryOrigin:
            cf_origins.S3BucketOrigin.withOriginAccessControl(optimizedBucket),
          fallbackOrigin: new cf_origins.HttpOrigin(
            cdk.Fn.parseDomainName(imageFunctionUrl.url),
            {
              customHeaders: {
                "X-CacheCow-Secret": cacheCowSecret.secretValue.toString(),
              },
            },
          ),
          fallbackStatusCodes: [403, 500, 503, 504],
        }),
        cachePolicy: new cf.CachePolicy(
          this,
          `ImageCachePolicy${this.node.addr}`,
          {
            defaultTtl: cdk.Duration.hours(24),
            maxTtl: cdk.Duration.days(365),
            minTtl: cdk.Duration.seconds(0),
          },
        ),
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: false,
        functionAssociations: [
          {
            eventType: cf.FunctionEventType.VIEWER_REQUEST,
            function: urlRewriteFunction,
          },
        ],
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
