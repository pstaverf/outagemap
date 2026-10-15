import { endpoint, actor } from '@/server/http';
import { reviewSchema } from '@/lib/schemas';
import { db } from '@/server/db';
import { z } from 'zod';
export const GET = endpoint(async request => { const locationKey = z.string().min(2).max(100).parse(new URL(request.url).searchParams.get('location')); const [items, summary] = await Promise.all([db.review.findMany({ where: { locationKey }, orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, text: true, rating: true, createdAt: true } }), db.review.aggregate({ where: { locationKey }, _avg: { rating: true }, _count: true })]); return { items, summary }; });
export const POST = endpoint(async request => { const user = await actor(request); return db.review.create({ data: { ...reviewSchema.parse(await request.json()), authorId: user.id, day: new Date(new Date().toISOString().slice(0, 10)) } }); });
