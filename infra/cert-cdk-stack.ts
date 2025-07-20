import * as cdk from "aws-cdk-lib";
import * as certificatemanager from "aws-cdk-lib/aws-certificatemanager";

export class CertificateStack extends cdk.Stack {
    public readonly certificateArn: string;

    constructor(scope: cdk.App, id: string, props: cdk.StackProps) {
        super(scope, id, { ...props, env: { region: "us-east-1" } });

        const certificate = new certificatemanager.Certificate(
            this,
            "CacheCowCert",
            {
                domainName: "cdn.babodigital.com",
                validation: certificatemanager.CertificateValidation.fromDns(),
            },
        );

        this.certificateArn = certificate.certificateArn;

        new cdk.CfnOutput(this, "CertificateArn", {
            value: this.certificateArn,
            description: "ARN of the ACM certificate of CacheCow",
        });
    }
}
