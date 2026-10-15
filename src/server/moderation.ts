import { db } from "./db";
import { auth } from "./auth";
import { HttpError } from "./http";
export async function moderator() {
  const session = await auth();
  const user = session?.user?.id
    ? await db.user.findUnique({ where: { id: session.user.id } })
    : null;
  if (!user || user.blocked || user.role !== "MODERATOR")
    throw new HttpError(403, "Требуется роль модератора");
  return user;
}
export async function moderationQueue() {
  return Promise.all([
    db.report.findMany({
      where: { handled: false },
      include: {
        issue: { select: { id: true, title: true, authorId: true } },
        review: { select: { id: true, text: true, authorId: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
}
