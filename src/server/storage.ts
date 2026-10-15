import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { randomUUID } from "node:crypto";
import { sanitizeImage } from "@/lib/images";
import { db } from "./db";
import { HttpError } from "./http";
const bucket = () => {
  if (!process.env.S3_BUCKET)
    throw new HttpError(503, "Хранилище фотографий не настроено");
  return process.env.S3_BUCKET;
};
const client = new S3Client({
  region: process.env.S3_REGION ?? "auto",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  },
});
const publicClient = new S3Client({
  region: process.env.S3_REGION ?? "auto",
  endpoint: process.env.S3_PUBLIC_ENDPOINT ?? process.env.S3_ENDPOINT,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  },
});
export async function signUpload(
  userId: string,
  contentType: string,
  size: number,
) {
  const key = `incoming/${userId}/${randomUUID()}`;
  return {
    key,
    ...(await createPresignedPost(publicClient, {
      Bucket: bucket(),
      Key: key,
      Expires: 300,
      Fields: { "Content-Type": contentType },
      Conditions: [
        ["content-length-range", 1, size],
        ["eq", "$Content-Type", contentType],
      ],
    })),
  };
}
export async function finalizeUpload(userId: string, key: string) {
  if (!key.startsWith(`incoming/${userId}/`) || key.includes(".."))
    throw new HttpError(403, "Файл недоступен");
  const object = await client.send(
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
  );
  if (
    !object.ContentLength ||
    object.ContentLength > 8 * 1024 * 1024 ||
    !object.Body
  )
    throw new HttpError(400, "Неверный размер фотографии");
  const body = await object.Body.transformToByteArray();
  let sanitized: Buffer;
  try {
    sanitized = await sanitizeImage(body, object.ContentType ?? "");
  } catch {
    throw new HttpError(400, "Файл не является допустимым JPEG, PNG или WebP");
  }
  const safeKey = `photos/${userId}/${randomUUID()}.webp`;
  await client.send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: safeKey,
      Body: sanitized,
      ContentType: "image/webp",
      CacheControl: "private, max-age=3600",
    }),
  );
  try {
    return await db.issueMedia.create({
      data: { key: safeKey, ownerId: userId },
    });
  } catch (error) {
    await client.send(
      new DeleteObjectCommand({ Bucket: bucket(), Key: safeKey }),
    );
    throw error;
  } finally {
    await client.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
  }
}
export async function photoUrl(key: string) {
  return getSignedUrl(
    publicClient,
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    { expiresIn: 300 },
  );
}
export async function deletePhotos(keys: string[]) {
  for (const key of keys)
    await client.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
