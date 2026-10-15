import { Prisma } from '@prisma/client';
import { db } from './db';
import { querySchema, type IssueInput } from '@/lib/schemas';
const include = { reactions: { select: { type: true } } } satisfies Prisma.IssueInclude;
export function serialize(issue: Prisma.IssueGetPayload<{ include: typeof include }>) {
  const { reactions, createdAt, updatedAt, resolvedAt, ...rest } = issue;
  void updatedAt; void resolvedAt;
  return { ...rest, createdAt: createdAt.toISOString(), affected: reactions.filter(r => r.type === 'AFFECTED').length, notAffected: reactions.filter(r => r.type === 'NOT_AFFECTED').length };
}
export async function listIssues(input: unknown) {
  const q = querySchema.parse(input);
  const items = await db.issue.findMany({ where: { lat: { gte: q.south, lte: q.north }, lng: { gte: q.west, lte: q.east }, category: q.category, status: q.status ?? { not: 'REJECTED' }, OR: [{ title: { contains: q.q, mode: 'insensitive' } }, { address: { contains: q.q, mode: 'insensitive' } }] }, include, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 51, ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}) });
  return { items: items.slice(0, 50).map(serialize), nextCursor: items.length > 50 ? items[49].id : null };
}
export async function getIssue(id: string) { const issue = await db.issue.findUnique({ where: { id }, include }); return issue && issue.status !== 'REJECTED' ? serialize(issue) : null; }
export async function createIssue(data: IssueInput, authorId: string) { return db.issue.create({ data: { ...data, authorId } }); }
export async function react(issueId: string, userId: string, type: 'AFFECTED' | 'NOT_AFFECTED' | null) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Issue" WHERE id = ${issueId} FOR UPDATE`;
    const issue = await tx.issue.findUniqueOrThrow({ where: { id: issueId } });
    if (issue.status === 'REJECTED' || issue.status === 'RESOLVED') throw new Error('CLOSED');
    if (type) await tx.reaction.upsert({ where: { userId_issueId: { userId, issueId } }, create: { userId, issueId, type }, update: { type } });
    else await tx.reaction.deleteMany({ where: { userId, issueId } });
    const affected = await tx.reaction.count({ where: { issueId, type: 'AFFECTED' } });
    await tx.issue.update({ where: { id: issueId }, data: { status: affected >= 3 ? 'CONFIRMED' : 'OPEN' } });
    return { affected, notAffected: await tx.reaction.count({ where: { issueId, type: 'NOT_AFFECTED' } }) };
  });
}
