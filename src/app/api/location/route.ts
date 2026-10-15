import { parseBody } from "@/server/http";
import { sameOrigin } from "@/lib/origin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  lookupLocation,
  trustedIP,
  encodeLocation,
  decodeLocation,
} from "@/server/location";
import { locationSchema } from "@/lib/schemas";
import { endpoint, HttpError } from "@/server/http";
export async function GET(request: Request) {
  const jar = await cookies();
  const cached = decodeLocation(jar.get("outagemap-location")?.value);
  const location = cached ?? (await lookupLocation(trustedIP(request.headers)));
  const response = NextResponse.json(location, {
    headers: { "Cache-Control": "private, no-store" },
  });
  if (!cached)
    response.cookies.set("outagemap-location", encodeLocation(location), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: location.source === "choice" ? 31536000 : 86400,
    });
  return response;
}
export const POST = endpoint(async (request) => {
  if (!sameOrigin(request))
    throw new HttpError(403, "Источник запроса не разрешён");
  const location = await parseBody(request, locationSchema);
  const jar = await cookies();
  jar.set(
    "outagemap-location",
    encodeLocation({ ...location, source: "choice" }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 31536000,
    },
  );
  return location;
});
