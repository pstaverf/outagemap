import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { moderationQueue } from "@/server/moderation";
import { ModerationActions } from "@/components/moderation-actions";
export const dynamic = "force-dynamic";
export default async function ModerationPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.blocked || user.role !== "MODERATOR") redirect("/");
  const [reports, audit] = await moderationQueue();
  return (
    <main className="document">
      <Link href="/">← На карту</Link>
      <h1>Модерация</h1>
      <h2>Жалобы ({reports.length})</h2>
      {reports.length ? (
        reports.map((report) => (
          <article className="profile-item" key={report.id}>
            <h3>{report.issue?.title ?? "Отзыв о местности"}</h3>
            {report.review && <p>{report.review.text}</p>}
            <p>{report.reason}</p>
            {report.issue && (
              <Link href={`/issues/${report.issue.id}`}>Открыть проблему</Link>
            )}
            <ModerationActions
              reportId={report.id}
              issueId={report.issueId}
              reviewId={report.reviewId}
              authorId={report.issue?.authorId ?? report.review?.authorId}
            />
          </article>
        ))
      ) : (
        <p>Необработанных жалоб нет.</p>
      )}
      <h2>Последние 100 действий</h2>
      {audit.map((entry) => (
        <article className="profile-item" key={entry.id}>
          <time>{entry.createdAt.toLocaleString("ru")}</time>
          <p>{entry.action}</p>
          <p className="fine-print">
            Объект: {entry.targetId} · Модератор:{" "}
            {entry.actorId ?? "Аккаунт удалён"}
          </p>
        </article>
      ))}
    </main>
  );
}
