import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth, signOut } from '@/server/auth';
import { db } from '@/server/db';
export const dynamic = 'force-dynamic';
export default async function Profile() { const session = await auth(); if (!session?.user?.id) redirect('/login'); const issues = await db.issue.findMany({ where: { authorId: session.user.id }, orderBy: { createdAt: 'desc' }, take: 100 }); return <main className="document"><Link href="/">← На карту</Link><h1>Ваш профиль</h1><p>{session.user.email}</p><h2>Мои проблемы</h2>{issues.length ? issues.map(issue => <p key={issue.id}><Link href={`/issues/${issue.id}`}>{issue.title}</Link></p>) : <p>Вы пока не сообщали о проблемах.</p>}<form action={async () => { 'use server'; await signOut({ redirectTo: '/' }); }}><button className="secondary">Выйти</button></form></main>; }
