import { z } from "zod";
const schema = z
  .object({
    AUTH_SECRET: z.string().min(32),
    AUTH_URL: z.url().startsWith("https://"),
    DATABASE_URL: z.string().startsWith("postgresql://"),
    REDIS_URL: z.string().min(10),
    TRUSTED_PROXY_SECRET: z.string().min(32),
    OPERATOR_NAME: z.string().min(3),
    OPERATOR_CONTACT: z.email(),
    DATA_JURISDICTION: z.enum(["KZ", "RU"]),
    DATA_RESIDENCY_ATTESTED: z.enum(["KZ", "RU"]),
    GEOLITE_CITY_PATH: z.string().min(1),
    GEOLITE_ASN_PATH: z.string().min(1),
    S3_BUCKET: z.string().min(1),
    S3_ENDPOINT: z.url().startsWith("https://"),
    S3_PUBLIC_ENDPOINT: z.url().startsWith("https://"),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(20),
    EMAIL_SERVER: z.string().min(10),
    EMAIL_FROM: z.string().min(5),
  })
  .refine(
    (value) => value.DATA_JURISDICTION === value.DATA_RESIDENCY_ATTESTED,
    "Подтверждение размещения должно совпадать с юрисдикцией",
  );
const result = schema.safeParse(process.env);
if (!result.success) {
  for (const issue of result.error.issues)
    process.stderr.write(`${issue.path.join(".")}: ${issue.message}\n`);
  process.exitCode = 1;
} else
  process.stdout.write(
    "Configuration validated. Physical data residency and legal review must be verified by the operator.\n",
  );
