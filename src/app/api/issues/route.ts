import { endpoint, actor } from '@/server/http';
import { listIssues, createIssue } from '@/server/issues';
import { issueSchema } from '@/lib/schemas';
import { limit } from '@/server/redis';
export const GET = endpoint(async request => listIssues(Object.fromEntries(new URL(request.url).searchParams)));
export const POST = endpoint(async request => { const user = await actor(request); await limit(`issue:${user.id}`, 5, 3600); return createIssue(issueSchema.parse(await request.json()), user.id); });
