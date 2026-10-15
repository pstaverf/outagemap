import type { MetadataRoute } from 'next';
import { db } from '@/server/db';
export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> { const base = process.env.AUTH_URL ?? 'http://localhost:3000'; const issues = await db.issue.findMany({ where: { status: { not: 'REJECTED' } }, select: { id: true, updatedAt: true }, take: 10000, orderBy: { updatedAt: 'desc' } }); return [{ url: base }, ...issues.map(issue => ({ url: `${base}/issues/${issue.id}`, lastModified: issue.updatedAt }))]; }
