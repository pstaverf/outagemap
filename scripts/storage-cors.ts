import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";
const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "us-east-1",
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  },
});
async function configure() {
  if (!process.env.S3_BUCKET || !process.env.AUTH_URL)
    throw new Error("S3_BUCKET and AUTH_URL are required");
  await client.send(
    new PutBucketCorsCommand({
      Bucket: process.env.S3_BUCKET,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: [new URL(process.env.AUTH_URL).origin],
            AllowedMethods: ["GET", "POST"],
            AllowedHeaders: ["Content-Type"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
}
configure()
  .catch(() => {
    process.stderr.write("Unable to configure storage CORS\n");
    process.exitCode = 1;
  })
  .finally(() => client.destroy());
