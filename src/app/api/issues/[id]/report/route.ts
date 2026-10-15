import { endpoint, actor } from '@/server/http';
import { reportSchema } from '@/lib/schemas';
import { db } from '@/server/db';
export const POST = endpoint(async request => { const user = await actor(request); return db.report.create({ data: { ...reportSchema.parse(await request.json()), authorId: user.id, issueId: new URL(request.url).pathname.split('/')[3] } }); });
