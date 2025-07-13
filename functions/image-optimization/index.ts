import * as s3 from "@aws-sdk/client-s3";
import {
    CloudFrontCustomOrigin,
    CloudFrontRequestHandler,
    CloudFrontResponseHandler,
    LambdaFunctionURLHandler,
} from "aws-lambda";
import sharp from "sharp";

// NOTE: IThink im mixing concepts, if the s3 bucket already failed, why do I refetch it with the lambda?

const s3Client = new s3.S3Client({});
const sourceBucket = process.env.SOURCE_BUCKET!;
const optimizedBucket = process.env.OPTIMIZED_BUCKET!;

export const handler: LambdaFunctionURLHandler = async (event, context) => {
    console.log(JSON.stringify(event, null, 4));

    if (event.requestContext.http.method !== "GET") {
        console.log(event);
        return {
            statusCode: 400,
            body: "Unsupported method, only GET is supported.",
        };
    }

    const imagePathArray = event.requestContext.http.path.split("/");
    const operations = imagePathArray.pop() ?? "";
    imagePathArray.shift();
    const originalImagePath = imagePathArray.join("/");

    const s3Key = originalImagePath + "/" + operations;
    console.log(s3Key, originalImagePath, operations, imagePathArray);

    try {
        const optimizedImage = await s3Client.send(
            new s3.HeadObjectCommand({
                Bucket: optimizedBucket,
                Key: s3Key,
            }),
        );

        if (optimizedImage) {
            return {
                statusCode: 302,
                headers: {
                    "Content-Type": "text/plain",
                    "Cache-Control": "private,no-store",
                    Location:
                        "/" +
                        originalImagePath +
                        "?" +
                        operations.replace(",", "&"),
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
                        Key: originalImagePath,
                    }),
                );
                const originalBody = await streamToBuffer(originalImage.Body);

                const resizedImage = await sharp(originalBody)
                    .resize(100, 100)
                    .toBuffer();

                await s3Client.send(
                    new s3.PutObjectCommand({
                        Bucket: optimizedBucket,
                        Key: s3Key,
                        Body: resizedImage,
                        ContentType: "image/jpeg",
                        CacheControl: "public, max-age=31536000, immutable",
                    }),
                );

                return {
                    statusCode: 302,
                    headers: {
                        Location:
                            "/" +
                            originalImagePath +
                            "?" +
                            operations.replace(",", "&"),
                        "Content-Type": "text/plain",
                        "Cache-Control": "private,no-store",
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
