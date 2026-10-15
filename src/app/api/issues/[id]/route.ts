import { parseBody } from "@/server/http";
import { actor, endpoint, HttpError } from "@/server/http";
import { getIssue } from "@/server/issues";
import { db } from "@/server/db";
import { auth } from "@/server/auth";
import { deletePhotos } from "@/server/storage";
import { issueSchema } from "@/lib/schemas";
export const GET = endpoint(async (request) => {
  const id = new URL(request.url).pathname.split("/")[3];
  const issue = await getIssue(id);
  if (!issue) throw new HttpError(404, "Проблема не найдена");
  const session = await auth();
  const user = session?.user?.id
    ? await db.user.findUnique({ where: { id: session.user.id } })
    : null;
  const reaction =
    user && !user.blocked
      ? await db.reaction.findUnique({
          where: { userId_issueId: { userId: user.id, issueId: id } },
        })
      : null;
  return {
    ...issue,
    myReaction: reaction?.type ?? null,
    canManage: Boolean(
      user &&
      !user.blocked &&
      (user.id === issue.authorId || user.role === "MODERATOR"),
    ),
    suggestResolve:
      issue.notAffected >= 3 && issue.notAffected > issue.affected,
  };
});
export const PATCH = endpoint(async (request) => {
  const user = await actor(request);
  const id = new URL(request.url).pathname.split("/")[3];
  const data = await parseBody(request, issueSchema);
  const changed = await db.issue.updateMany({
    where: { id, authorId: user.id, status: { in: ["OPEN", "CONFIRMED"] } },
    data,
  });
  if (!changed.count) throw new HttpError(403, "Редактирование недоступно");
  return { updated: true };
});
export const DELETE = endpoint(async (request) => {
  const user = await actor(request);
  const id = new URL(request.url).pathname.split("/")[3];
  await db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Issue" WHERE id = ${id} FOR UPDATE`;
      const issue = await tx.issue.findFirst({
        where: { id, authorId: user.id },
        include: { media: { select: { key: true } } },
      });
      if (!issue) throw new HttpError(404, "Проблема не найдена");
      if (issue.media.length)
        await deletePhotos(issue.media.map((photo) => photo.key));
      await tx.issue.delete({ where: { id } });
    },
    { timeout: 30000 },
  );
  return { deleted: true };
});
