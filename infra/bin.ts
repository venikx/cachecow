#!/usr/bin/env node

import * as cdk from "aws-cdk-lib";
import { CacheCowCdkStack } from "./cdn-cdk-stack";

const app = new cdk.App();

new CacheCowCdkStack(app, "CacheCowStack", {
  env: { region: "eu-north-1" },
});
