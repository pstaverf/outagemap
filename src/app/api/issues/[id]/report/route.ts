import { parseBody } from "@/server/http";
import { endpoint, actor, HttpError } from "@/server/http";
import { reportSchema } from "@/lib/schemas";
import { db } from "@/server/db";
export const POST = endpoint(async (request) => {
  const user = await actor(request);
  const issueId = new URL(request.url).pathname.split("/")[3];
  const issue = await db.issue.findFirst({
    where: { id: issueId, status: { not: "REJECTED" } },
  });
  if (!issue) throw new HttpError(404, "Проблема не найдена");
  return db.report.create({
    data: {
      ...(await parseBody(request, reportSchema)),
      authorId: user.id,
      issueId,
    },
  });
});
