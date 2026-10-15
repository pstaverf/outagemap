import { parseBody } from "@/server/http";
import { sameOrigin } from "@/lib/origin";
import { cookies } from "next/headers";
import { z } from "zod";
import { endpoint, HttpError } from "@/server/http";
export const POST = endpoint(async (request) => {
  if (!sameOrigin(request))
    throw new HttpError(403, "Источник запроса не разрешён");
  const { remember } = await parseBody(
    request,
    z.object({ remember: z.boolean() }),
  );
  (await cookies()).set("outagemap-remember", remember ? "yes" : "no", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 31536000,
  });
  return { saved: true };
});
