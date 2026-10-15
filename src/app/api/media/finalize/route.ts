import { parseBody } from "@/server/http";
import { actor, endpoint } from "@/server/http";
import { mediaFinalizeSchema } from "@/lib/schemas";
import { finalizeUpload } from "@/server/storage";
export const POST = endpoint(async (request) => {
  const user = await actor(request);
  return finalizeUpload(
    user.id,
    (await parseBody(request, mediaFinalizeSchema)).key,
  );
});
