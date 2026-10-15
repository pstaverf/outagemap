import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getIssue } from "@/server/issues";
import { categories, statuses } from "@/lib/schemas";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const issue = await getIssue((await params).id);
  return {
    title: issue ? `${issue.title} — OutageMap` : "Проблема не найдена",
    description: issue?.description.slice(0, 160),
    openGraph: {
      title: issue?.title,
      description: issue?.description.slice(0, 160),
      type: "article",
    },
  };
}
export default async function IssuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const issue = await getIssue((await params).id);
  if (!issue) notFound();
  return (
    <main className="document">
      <Link href={`/?issue=${issue.id}`}>← Показать на карте</Link>
      <h1>{issue.title}</h1>
      <p>
        {categories[issue.category]} · {statuses[issue.status]}
      </p>
      <p>
        {issue.city}, {issue.address}
      </p>
      <p>{issue.description}</p>
      <p>
        {issue.affected} подтверждений · {issue.notAffected} сообщений о
        работающей услуге
      </p>
      <time dateTime={issue.createdAt}>
        {new Date(issue.createdAt).toLocaleString("ru")}
      </time>
    </main>
  );
}
