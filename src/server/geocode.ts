import { redis } from "./redis";
import { HttpError } from "./http";
import { geocodeResultSchema } from "@/lib/schemas";
import { z } from "zod";
export async function geocode(
  parameters: Record<string, string>,
  reverse = false,
) {
  const key = `geocode:${reverse}:${JSON.stringify(parameters)}`;
  const schema = reverse ? geocodeResultSchema : z.array(geocodeResultSchema);
  const cached = await redis.get(key);
  if (cached) return schema.parse(JSON.parse(cached));
  if (!(await redis.set("nominatim:lock", "1", "EX", 1, "NX")))
    throw new HttpError(429, "Повторите поиск через секунду");
  const url = new URL(
    reverse ? "/reverse" : "/search",
    process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org",
  );
  url.search = new URLSearchParams({
    ...parameters,
    format: "jsonv2",
    "accept-language": "ru",
    polygon_geojson: "1",
    ...(reverse ? {} : { limit: "5", countrycodes: "kz,ru" }),
  }).toString();
  const response = await fetch(url, {
    headers: {
      "User-Agent": process.env.GEOCODER_USER_AGENT ?? "OutageMap/1.0",
    },
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new HttpError(503, "Поиск адресов недоступен");
  const raw: unknown = await response.json();
  const data = schema.parse(raw);
  await redis.set(key, JSON.stringify(raw), "EX", 86400);
  return data;
}
