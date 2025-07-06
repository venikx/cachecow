import { APIGatewayProxyHandler } from "aws-lambda";
import sharp from "sharp";

export const handler: APIGatewayProxyHandler = async () => {
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
        headers: { "Content-Type": "image/png" },
        body: buffer.toString("base64"),
        isBase64Encoded: true,
    };
};
