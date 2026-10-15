import { parseBody } from "@/server/http";
import { actor, endpoint, HttpError } from "@/server/http";
import { moderator, moderationQueue } from "@/server/moderation";
import { moderatorActionSchema } from "@/lib/schemas";
import { db } from "@/server/db";
export const GET = endpoint(async () => {
  await moderator();
  const [reports, audit] = await moderationQueue();
  return { reports, audit };
});
export const POST = endpoint(async (request) => {
  const user = await actor(request);
  if (user.role !== "MODERATOR") throw new HttpError(403, "Недостаточно прав");
  const data = await parseBody(request, moderatorActionSchema);
  return db.$transaction(async (tx) => {
    let targetId: string;
    if (data.action === "block") {
      if (data.userId === user.id)
        throw new HttpError(400, "Нельзя заблокировать себя");
      const target = await tx.user.findUnique({ where: { id: data.userId } });
      if (!target || target.role === "MODERATOR")
        throw new HttpError(403, "Изменение этой учётной записи недоступно");
      await tx.user.update({
        where: { id: data.userId },
        data: { blocked: data.blocked },
      });
      if (data.blocked)
        await tx.session.deleteMany({ where: { userId: data.userId } });
      targetId = data.userId;
    } else if (data.action === "hide-review") {
      await tx.review.update({
        where: { id: data.reviewId },
        data: { hidden: true },
      });
      await tx.report.updateMany({
        where: { reviewId: data.reviewId },
        data: { handled: true },
      });
      targetId = data.reviewId;
    } else {
      await tx.report.update({
        where: { id: data.reportId },
        data: { handled: true },
      });
      targetId = data.reportId;
    }
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        targetId,
        action: `${data.action}: ${data.reason}`,
      },
    });
    return { updated: true };
  });
});
