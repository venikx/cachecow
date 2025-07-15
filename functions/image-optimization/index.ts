import * as s3 from "@aws-sdk/client-s3";
import { LambdaFunctionURLHandler } from "aws-lambda";
import sharp from "sharp";

// NOTE(venikx): configuration
const SOURCE_BUCKET = process.env.SOURCE_BUCKET!;
const OPTIMIZED_BUCKET = process.env.OPTIMIZED_BUCKET!;

const CACHE_CONTROL_OPTIMIZED = "public, max-age=31536000, immutable";
const CACHE_CONTROL_REDIRECT = "private, no-store, no-cache";
const s3Client = new s3.S3Client({});

// NOTE(venikx): CloudFront hits this lambda only when S3 doesn't have the optimized image
export const handler: LambdaFunctionURLHandler = async (event) => {
    if (event.requestContext.http.method !== "GET") {
        return {
            statusCode: 405,
            body: "Method not allowed",
            headers: {
                "Cache-Control": CACHE_CONTROL_REDIRECT,
            },
        };
    }

    const pathParts = event.requestContext.http.path.split("/").filter(Boolean);
    const operations = pathParts.pop() || "";
    const imagePath = pathParts.join("/");
    const s3Key = `${imagePath}/${operations}`;

    const getObjectCommand = new s3.GetObjectCommand({
        Bucket: SOURCE_BUCKET,
        Key: imagePath,
    });

    let originalResponse: s3.GetObjectCommandOutput;
    try {
        originalResponse = await s3Client.send(getObjectCommand);
    } catch (err) {
        console.error("Original image not found:", imagePath, err);
        return {
            statusCode: 404,
            body: "Original image not found",
            headers: {
                "Cache-Control": CACHE_CONTROL_REDIRECT,
                "Content-Type": "text/plain",
            },
        };
    }

    if (!originalResponse.Body) {
        return {
            statusCode: 404,
            body: "Empty response body",
            headers: {
                "Cache-Control": CACHE_CONTROL_REDIRECT,
                "Content-Type": "text/plain",
            },
        };
    }

    const stream = originalResponse.Body as NodeJS.ReadableStream;
    const chunks: Uint8Array[] = [];

    const originalImageBuffer = await new Promise<Buffer>((resolve, reject) => {
        stream.on("data", (chunk: Uint8Array) => chunks.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
    }).catch((err) => {
        console.error("Failed to read image stream:", err);
        return null;
    });

    if (!originalImageBuffer) {
        return {
            statusCode: 500,
            body: "Failed to read image data",
            headers: {
                "Cache-Control": CACHE_CONTROL_REDIRECT,
                "Content-Type": "text/plain",
            },
        };
    }

    let outputBuffer: Buffer;
    try {
        outputBuffer = await sharp(originalImageBuffer)
            .resize(100, 100)
            .toBuffer();
    } catch (err) {
        console.error("Image transformation failed:", err);
        return {
            statusCode: 500,
            body: "Image transformation failed",
            headers: {
                "Cache-Control": CACHE_CONTROL_REDIRECT,
                "Content-Type": "text/plain",
            },
        };
    }

    const putObjectCommand = new s3.PutObjectCommand({
        Bucket: OPTIMIZED_BUCKET,
        Key: s3Key,
        Body: outputBuffer,
        ContentType: "image/jpeg",
        CacheControl: CACHE_CONTROL_OPTIMIZED,
    });

    try {
        await s3Client.send(putObjectCommand);
    } catch (err) {
        console.error("Failed to upload optimized image:", err);
        return {
            statusCode: 500,
            body: "Failed to upload optimized image",
            headers: {
                "Cache-Control": CACHE_CONTROL_REDIRECT,
                "Content-Type": "text/plain",
            },
        };
    }

    return {
        statusCode: 302,
        body: "",
        headers: {
            Location: `/${imagePath}?${operations.replace(",", "&")}`,
            "Content-Type": "text/plain",
            "Cache-Control": CACHE_CONTROL_REDIRECT,
        },
    };
};
