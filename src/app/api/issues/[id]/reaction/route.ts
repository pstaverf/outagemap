import { parseBody } from "@/server/http";
import { endpoint, actor } from "@/server/http";
import { reactionSchema } from "@/lib/schemas";
import { react } from "@/server/issues";
export const POST = endpoint(async (request) => {
  const user = await actor(request);
  const id = new URL(request.url).pathname.split("/")[3];
  return react(id, user.id, (await parseBody(request, reactionSchema)).type);
});
