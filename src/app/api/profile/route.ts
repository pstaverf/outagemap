import { parseBody } from "@/server/http";
import { endpoint, actor } from "@/server/http";
import { db } from "@/server/db";
import { safeText } from "@/lib/schemas";
import { z } from "zod";
import { deletePhotos } from "@/server/storage";
export const POST = endpoint(async (request) => {
  const user = await actor(request);
  return db.user.findUnique({
    where: { id: user.id },
    select: {
      name: true,
      email: true,
      issues: { include: { media: { select: { id: true } } } },
      reviews: true,
      reactions: true,
      reports: true,
    },
  });
});
export const PATCH = endpoint(async (request) => {
  const user = await actor(request);
  const data = await parseBody(request, z.object({ name: safeText(2, 100) }));
  await db.user.update({ where: { id: user.id }, data });
  return { updated: true };
});
export const DELETE = endpoint(async (request) => {
  const user = await actor(request);
  const photos = await db.issueMedia.findMany({
    where: { ownerId: user.id },
    select: { key: true },
  });
  if (photos.length) await deletePhotos(photos.map((photo) => photo.key));
  await db.$transaction(async (tx) => {
    const reactions = await tx.reaction.findMany({
      where: { userId: user.id },
      select: { issueId: true },
      orderBy: { issueId: "asc" },
    });
    for (const reaction of reactions)
      await tx.$queryRaw`SELECT id FROM "Issue" WHERE id = ${reaction.issueId} FOR UPDATE`;
    await tx.issueMedia.deleteMany({ where: { ownerId: user.id } });
    await tx.verificationToken.deleteMany({
      where: { identifier: user.email ?? "" },
    });
    await tx.user.delete({ where: { id: user.id } });
    for (const reaction of reactions) {
      const [affectedCount, notAffectedCount] = await Promise.all([
        tx.reaction.count({
          where: { issueId: reaction.issueId, type: "AFFECTED" },
        }),
        tx.reaction.count({
          where: { issueId: reaction.issueId, type: "NOT_AFFECTED" },
        }),
      ]);
      await tx.issue.updateMany({
        where: { id: reaction.issueId },
        data: { affectedCount, notAffectedCount },
      });
      await tx.issue.updateMany({
        where: { id: reaction.issueId, status: { in: ["OPEN", "CONFIRMED"] } },
        data: { status: affectedCount >= 3 ? "CONFIRMED" : "OPEN" },
      });
    }
  });
  return { deleted: true };
});
