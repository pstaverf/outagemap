import { endpoint } from "@/server/http";
import { geocode } from "@/server/geocode";
import { pointSchema, safeText } from "@/lib/schemas";
export const GET = endpoint(async (request) => {
  const params = new URL(request.url).searchParams;
  if (params.has("lat")) {
    const point = pointSchema.parse(Object.fromEntries(params));
    return geocode({ lat: String(point.lat), lon: String(point.lng) }, true);
  }
  return geocode({ q: safeText(3, 150).parse(params.get("q")) });
});
