import { parseBody } from "@/server/http";
import { endpoint, actor, HttpError } from "@/server/http";
import { moderationSchema } from "@/lib/schemas";
import { db } from "@/server/db";
export const POST = endpoint(async (request) => {
  const user = await actor(request);
  const id = new URL(request.url).pathname.split("/")[3];
  const data = await parseBody(request, moderationSchema);
  const issue = await db.issue.findUnique({ where: { id } });
  if (!issue) throw new HttpError(404, "Проблема не найдена");
  if (
    user.role !== "MODERATOR" &&
    (issue.authorId !== user.id || data.status !== "RESOLVED")
  )
    throw new HttpError(403, "Недостаточно прав");
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Issue" WHERE id = ${id} FOR UPDATE`;
    const current = await tx.issue.findUniqueOrThrow({ where: { id } });
    if (user.role !== "MODERATOR" && current.status === "REJECTED")
      throw new HttpError(403, "Проблема скрыта модератором");
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: `${data.status}: ${data.reason}`,
        targetId: id,
      },
    });
    if (user.role === "MODERATOR")
      await tx.report.updateMany({
        where: { issueId: id },
        data: { handled: true },
      });
    return tx.issue.update({
      where: { id },
      data: {
        status: data.status,
        resolvedAt: data.status === "RESOLVED" ? new Date() : null,
      },
    });
  });
});
