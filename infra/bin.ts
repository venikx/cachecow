#!/usr/bin/env node

import * as cdk from "aws-cdk-lib";
import { CacheCowCdkStack } from "./cdn-cdk-stack";
import { CertificateStack } from "./cert-cdk-stack";

const app = new cdk.App();

const certStack = new CertificateStack(app, "CertificateStack", {
  env: { region: "us-east-1" },
  crossRegionReferences: true,
});

const cdnStack = new CacheCowCdkStack(app, "CacheCowStack", {
  env: { region: "eu-north-1" },
  certificateArn: certStack.certificateArn,
  crossRegionReferences: true,
});
