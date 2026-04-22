import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Injectable } from "@nestjs/common";

@Injectable()
export class S3Service {
    private readonly client: S3Client;
    private readonly bucket: string;


    constructor() {
        this.bucket = process.env.S3_BUCKET!;

        this.client = new S3Client({
            region: process.env.S3_REGION,
            endpoint: process.env.S3_ENDPOINT,
            credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY!,
                secretAccessKey: process.env.S3_SECRET_KEY!,
            },
        });
    }

    async uploadCardPhoto(key: string, buffer: Buffer, contentType: string) {
        await this.client.send(new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: buffer,
            ContentType: contentType,
            ACL: 'public-read'
        }));
    }

    async deleteCardPhoto(key: string) {
        await this.client.send(new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
        }))
    }

    async getCardPhotoBuffer(key: string) {
        const result = await this.client.send(
            new GetObjectCommand({
                Bucket: this.bucket,
                Key: key,
            }),
        );

        // В AWS SDK v3 Body на Node обычно ReadableStream.
        const contentType = result.ContentType ?? 'application/octet-stream';
        const body = result.Body as any;
        const chunks: Buffer[] = [];
        for await (const chunk of body) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }

        return {
            buffer: Buffer.concat(chunks),
            contentType,
        };
    }
}