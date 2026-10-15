import { endpoint } from "@/server/http";
import { nearby } from "@/server/issues";
import { pointSchema } from "@/lib/schemas";
export const GET = endpoint(async (request) => {
  const point = pointSchema.parse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  return { items: await nearby(point.lat, point.lng) };
});
