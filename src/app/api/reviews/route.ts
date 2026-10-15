import { parseBody } from "@/server/http";
import { endpoint, actor } from "@/server/http";
import { reviewSchema } from "@/lib/schemas";
import { db } from "@/server/db";
import { limit } from "@/server/redis";
export const GET = endpoint(async (request) => {
  const locationKey = reviewSchema.shape.locationKey.parse(
    new URL(request.url).searchParams.get("location"),
  );
  const where = { locationKey, hidden: false };
  const [items, summary] = await Promise.all([
    db.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, text: true, rating: true, createdAt: true },
    }),
    db.review.aggregate({ where, _avg: { rating: true }, _count: true }),
  ]);
  return { items, summary };
});
export const POST = endpoint(async (request) => {
  const user = await actor(request);
  await limit(`review:${user.id}`, 5, 3600);
  return db.review.create({
    data: {
      ...(await parseBody(request, reviewSchema)),
      authorId: user.id,
      day: new Date(new Date().toISOString().slice(0, 10)),
    },
  });
});
