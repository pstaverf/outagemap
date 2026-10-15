import { parseBody } from "@/server/http";
import { endpoint, actor, HttpError } from "@/server/http";
import { reviewSchema, reportSchema } from "@/lib/schemas";
import { db } from "@/server/db";
export const PATCH = endpoint(async (request) => {
  const user = await actor(request);
  const id = new URL(request.url).pathname.split("/")[3];
  const data = await parseBody(
    request,
    reviewSchema.pick({ rating: true, text: true }),
  );
  const changed = await db.review.updateMany({
    where: { id, authorId: user.id, hidden: false },
    data,
  });
  if (!changed.count) throw new HttpError(404, "Отзыв не найден");
  return { updated: true };
});
export const DELETE = endpoint(async (request) => {
  const user = await actor(request);
  const changed = await db.review.deleteMany({
    where: {
      id: new URL(request.url).pathname.split("/")[3],
      authorId: user.id,
    },
  });
  if (!changed.count) throw new HttpError(404, "Отзыв не найден");
  return { deleted: true };
});
export const POST = endpoint(async (request) => {
  const user = await actor(request);
  const reviewId = new URL(request.url).pathname.split("/")[3];
  const review = await db.review.findFirst({
    where: { id: reviewId, hidden: false },
  });
  if (!review) throw new HttpError(404, "Отзыв не найден");
  return db.report.create({
    data: {
      ...(await parseBody(request, reportSchema)),
      authorId: user.id,
      reviewId,
    },
  });
});
