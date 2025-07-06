#!/usr/bin/env node

import * as cdk from "aws-cdk-lib";
import { CdnCdkStack } from "./cdn-cdk-stack";

const app = new cdk.App();

new CdnCdkStack(app, "CdnCdkStack", {
  env: { region: "eu-north-1" },
});
