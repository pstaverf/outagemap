import { endpoint } from "@/server/http";
import { db } from "@/server/db";
import { redis } from "@/server/redis";
export const dynamic = "force-dynamic";
export const GET = endpoint(async () => {
  await Promise.all([db.$queryRaw`SELECT 1`, redis.ping()]);
  return { status: "ok" };
});
