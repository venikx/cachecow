import * as s3 from "@aws-sdk/client-s3";
import { LambdaFunctionURLHandler } from "aws-lambda";
import sharp from "sharp";

// === CONFIGURATION ===
const SOURCE_BUCKET = process.env.SOURCE_BUCKET!;
const OPTIMIZED_BUCKET = process.env.OPTIMIZED_BUCKET!;

const s3Client = new s3.S3Client({});

// === HELPERS ===
function parseRequestPath(path: string): {
    imagePath: string;
    operations: string;
} {
    const parts = path.split("/").filter(Boolean);
    const operations = parts.pop() || "";
    return { imagePath: parts.join("/"), operations };
}

async function streamToBuffer(stream: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Uint8Array[] = [];
        stream.on("data", (chunk: Uint8Array) => chunks.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
    });
}

function redirectResponse(location: string): any {
    return {
        statusCode: 302,
        headers: {
            Location: location,
            "Content-Type": "text/plain",
            "Cache-Control": "private,no-store",
        },
    };
}

// === MAIN HANDLER ===
// NOTE(venikx): The CloudFront distribution is configured to use 2 origins (S3 + this lambda). If the
// lambda runs it's implied the asset could not be found in S3.
export const handler: LambdaFunctionURLHandler = async (event) => {
    if (event.requestContext.http.method !== "GET") {
        return { statusCode: 400, body: "Only GET is supported." };
    }

    const { imagePath, operations } = parseRequestPath(
        event.requestContext.http.path,
    );
    const s3Key = `${imagePath}/${operations}`;

    let originalImageBuffer: Buffer;
    try {
        const original = await s3Client.send(
            new s3.GetObjectCommand({
                Bucket: SOURCE_BUCKET,
                Key: imagePath,
            }),
        );

        originalImageBuffer = await streamToBuffer(original.Body);
    } catch (err) {
        console.error("Original image not found or fetch failed:", err);
        return {
            statusCode: 404,
            body: "Original image not found or fetch failed",
        };
    }

    let outputBuffer: Buffer;
    try {
        // NOTE(venikx): Hardcoded resize for now — can parse operations string here
        outputBuffer = await sharp(originalImageBuffer)
            .resize(100, 100)
            .toBuffer();
    } catch (err) {
        console.error("Image transformation failed:", err);
        return { statusCode: 500, body: "Image transformation failed." };
    }

    try {
        await s3Client.send(
            new s3.PutObjectCommand({
                Bucket: OPTIMIZED_BUCKET,
                Key: s3Key,
                Body: outputBuffer,
                ContentType: "image/jpeg",
                CacheControl: "public, max-age=31536000, immutable",
            }),
        );
    } catch (err) {
        console.error("Failed to write optimized image:", err);
        return { statusCode: 500, body: "Failed to upload optimized image." };
    }

    return redirectResponse(`/${imagePath}?${operations.replace(",", "&")}`);
};
