import { distance } from "@/lib/geo";
import { cache } from "react";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { HttpError } from "./http";
import { querySchema, type createIssueSchema } from "@/lib/schemas";
import type { z } from "zod";
const include = {
  media: { select: { id: true } },
} satisfies Prisma.IssueInclude;
export function serialize(
  issue: Prisma.IssueGetPayload<{ include: typeof include }>,
) {
  return {
    id: issue.id,
    title: issue.title,
    description: issue.description,
    category: issue.category,
    status: issue.status,
    lat: issue.lat,
    lng: issue.lng,
    region: issue.region,
    city: issue.city,
    address: issue.address,
    authorId: issue.authorId,
    createdAt: issue.createdAt.toISOString(),
    affected: issue.affectedCount,
    notAffected: issue.notAffectedCount,
    mediaIds: issue.media.map((m) => m.id),
  };
}
export async function listIssues(input: unknown) {
  const q = querySchema.parse(input);
  const since =
    q.period === "all"
      ? undefined
      : new Date(
          Date.now() - { day: 1, week: 7, month: 30 }[q.period] * 86400000,
        );
  const where: Prisma.IssueWhereInput = {
    lat: { gte: q.south, lte: q.north },
    status: q.status ?? { not: "REJECTED" },
    category: q.category,
    region: q.region ? { contains: q.region, mode: "insensitive" } : undefined,
    createdAt: since ? { gte: since } : undefined,
    AND: [
      {
        OR:
          q.west <= q.east
            ? [{ lng: { gte: q.west, lte: q.east } }]
            : [{ lng: { gte: q.west } }, { lng: { lte: q.east } }],
      },
      {
        OR: [
          { title: { contains: q.q, mode: "insensitive" } },
          { address: { contains: q.q, mode: "insensitive" } },
        ],
      },
    ],
  };
  const items = await db.issue.findMany({
    where,
    include,
    orderBy: [
      ...(q.sort === "affected" ? [{ affectedCount: "desc" as const }] : []),
      { createdAt: "desc" },
      { id: "desc" },
    ],
    take: 51,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
  });
  return {
    items: items.slice(0, 50).map(serialize),
    nextCursor: items.length > 50 ? items[49].id : null,
  };
}
export const getIssue = cache(async (id: string) => {
  const issue = await db.issue.findUnique({ where: { id }, include });
  return issue && issue.status !== "REJECTED" ? serialize(issue) : null;
});
export async function createIssue(
  data: z.infer<typeof createIssueSchema>,
  authorId: string,
) {
  const { mediaIds, ...fields } = data;
  return db.$transaction(async (tx) => {
    const media = await tx.issueMedia.findMany({
      where: { id: { in: mediaIds }, ownerId: authorId, issueId: null },
    });
    if (media.length !== new Set(mediaIds).size)
      throw new HttpError(400, "Фотография недоступна или уже прикреплена");
    const issue = await tx.issue.create({ data: { ...fields, authorId } });
    const attached = await tx.issueMedia.updateMany({
      where: { id: { in: mediaIds }, ownerId: authorId, issueId: null },
      data: { issueId: issue.id },
    });
    if (attached.count !== media.length)
      throw new HttpError(409, "Фотографии уже использованы");
    return issue;
  });
}
export async function nearby(lat: number, lng: number) {
  const latitude = 150 / 111320;
  const longitude = latitude / Math.max(Math.cos((lat * Math.PI) / 180), 0.08);
  const items = await db.issue.findMany({
    where: {
      lat: { gte: lat - latitude, lte: lat + latitude },
      lng: { gte: lng - longitude, lte: lng + longitude },
      status: { in: ["OPEN", "CONFIRMED"] },
    },
    include,
    take: 200,
  });
  return items
    .filter((i) => distance(lat, lng, i.lat, i.lng) <= 150)
    .map(serialize);
}
export async function react(
  issueId: string,
  userId: string,
  type: "AFFECTED" | "NOT_AFFECTED" | null,
) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Issue" WHERE id = ${issueId} FOR UPDATE`;
    const issue = await tx.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new HttpError(404, "Проблема не найдена");
    if (issue.status === "REJECTED" || issue.status === "RESOLVED")
      throw new HttpError(409, "Проблема уже закрыта");
    if (type)
      await tx.reaction.upsert({
        where: { userId_issueId: { userId, issueId } },
        create: { userId, issueId, type },
        update: { type },
      });
    else await tx.reaction.deleteMany({ where: { userId, issueId } });
    const [affected, notAffected] = await Promise.all([
      tx.reaction.count({ where: { issueId, type: "AFFECTED" } }),
      tx.reaction.count({ where: { issueId, type: "NOT_AFFECTED" } }),
    ]);
    await tx.issue.update({
      where: { id: issueId },
      data: {
        status: affected >= 3 ? "CONFIRMED" : "OPEN",
        affectedCount: affected,
        notAffectedCount: notAffected,
      },
    });
    return { affected, notAffected, type };
  });
}
