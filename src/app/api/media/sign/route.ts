import { parseBody } from "@/server/http";
import { actor, endpoint } from "@/server/http";
import { uploadSchema } from "@/lib/schemas";
import { signUpload } from "@/server/storage";
import { limit } from "@/server/redis";
export const POST = endpoint(async (request) => {
  const user = await actor(request);
  await limit(`photos:${user.id}`, 25, 3600);
  const data = await parseBody(request, uploadSchema);
  return signUpload(user.id, data.contentType, data.size);
});
