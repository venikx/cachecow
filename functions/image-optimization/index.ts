import * as s3 from "@aws-sdk/client-s3";
import {
    CloudFrontCustomOrigin,
    CloudFrontRequestHandler,
    CloudFrontResponseHandler,
    LambdaFunctionURLHandler,
} from "aws-lambda";
import sharp from "sharp";

const s3Client = new s3.S3Client({});
const sourceBucket = process.env.SOURCE_BUCKET!;
const optimizedBucket = process.env.OPTIMIZED_BUCKET!;

export const handler: LambdaFunctionURLHandler = async (event, context) => {
    const key = "DSCF5881.jpg";

    console.log(key, JSON.stringify(event, null, 4));

    try {
        const optimizedImage = await s3Client.send(
            new s3.HeadObjectCommand({
                Bucket: optimizedBucket,
                Key: key,
            }),
        );

        if (optimizedImage) {
            return {
                statusCode: 302,
                headers: {
                    "Content-Type": "text/plain",
                    Location: `/${key}`,
                },
            };
        } else {
            return {
                statusCode: 500,
                body: "help",
            };
        }
    } catch (error: any) {
        console.log("S3 error:", JSON.stringify(error, null, 2));

        if (error.name === "NotFound") {
            try {
                const originalImage = await s3Client.send(
                    new s3.GetObjectCommand({
                        Bucket: sourceBucket,
                        Key: key,
                    }),
                );
                const originalBody = await streamToBuffer(originalImage.Body);

                const resizedImage = await sharp(originalBody)
                    .resize(100, 100)
                    .toBuffer();

                await s3Client.send(
                    new s3.PutObjectCommand({
                        Bucket: optimizedBucket,
                        Key: key,
                        Body: resizedImage,
                        ContentType: "image/jpeg",
                        CacheControl: "public, max-age=31536000, immutable",
                    }),
                );

                return {
                    statusCode: 302,
                    headers: {
                        Location: `https://${optimizedBucket}.s3.amazonaws.com/${key}`,
                        "Content-Type": "text/plain",
                    },
                };
            } catch (e: any) {
                const buffer = await sharp({
                    create: {
                        width: 100,
                        height: 100,
                        channels: 4,
                        background: { r: 255, g: 0, b: 0, alpha: 1 },
                    },
                })
                    .png()
                    .toBuffer();

                return {
                    statusCode: 200,
                    headers: { "Content-Type": "image/png", Location: "" },
                    body: buffer.toString("base64"),
                    isBase64Encoded: true,
                };
            }
        }

        return {
            statusCode: 500,
            body: "Error downloading original image",
        };
    }
};

async function streamToBuffer(stream: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Uint8Array[] = [];
        stream.on("data", (chunk: Uint8Array) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks)));
    });
}
