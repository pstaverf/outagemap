import { endpoint, actor } from '@/server/http';
import { db } from '@/server/db';
export const POST = endpoint(async request => { const user = await actor(request); return db.user.findUnique({ where: { id: user.id }, select: { name: true, email: true, issues: true, reviews: true, reactions: true } }); });
export const DELETE = endpoint(async request => { const user = await actor(request); await db.user.delete({ where: { id: user.id } }); return { deleted: true }; });
