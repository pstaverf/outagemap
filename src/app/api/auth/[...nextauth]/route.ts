import { sameOrigin } from "@/lib/origin";
import type { NextRequest } from "next/server";
import { handlers } from "@/server/auth";
import { endpoint, HttpError } from "@/server/http";
import { trustedIP } from "@/server/location";
import { limit } from "@/server/redis";
export async function GET(request: NextRequest) {
  if (new URL(request.url).pathname.includes("/callback/")) {
    const guard = endpoint(async () => {
      const ip = trustedIP(request.headers);
      if (ip) await limit(`auth-callback:${ip}`, 30, 60);
      return { allowed: true };
    });
    const result = await guard(request);
    if (!result.ok) return result;
  }
  return handlers.GET(request);
}
export async function POST(request: NextRequest) {
  const check = endpoint(async () => {
    if (!sameOrigin(request))
      throw new HttpError(403, "Источник запроса не разрешён");
    await limit("auth:global", 1000, 60);
    const ip = trustedIP(request.headers);
    if (ip) await limit(`auth-ip:${ip}`, 15, 900);
    if (Number(request.headers.get("content-length") ?? "0") > 16384)
      throw new HttpError(413, "Слишком большой запрос");
    return { allowed: true };
  });
  const checked = await check(request);
  if (!checked.ok) return checked;
  return handlers.POST(request);
}
