import { NextResponse } from "next/server";
import { endpoint, HttpError, actor } from "@/server/http";
import { db } from "@/server/db";
import { photoUrl, deletePhotos } from "@/server/storage";
import { auth } from "@/server/auth";
export async function GET(request: Request) {
  const handler = endpoint(async () => {
    const id = new URL(request.url).pathname.split("/")[3];
    const media = await db.issueMedia.findUnique({
      where: { id },
      include: { issue: { select: { status: true } } },
    });
    if (!media) throw new HttpError(404, "Фотография не найдена");
    if (!media.issue || media.issue.status === "REJECTED") {
      const session = await auth();
      if (session?.user?.id !== media.ownerId)
        throw new HttpError(404, "Фотография не найдена");
    }
    return { url: await photoUrl(media.key) };
  });
  const result = await handler(request);
  if (!result.ok) return result;
  const data: unknown = await result.json();
  if (
    typeof data !== "object" ||
    data === null ||
    !("url" in data) ||
    typeof data.url !== "string"
  )
    return NextResponse.json(
      { error: { code: "503", message: "Фотография недоступна" } },
      { status: 503 },
    );
  return NextResponse.redirect(data.url, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
export const DELETE = endpoint(async (request) => {
  const user = await actor(request);
  const media = await db.issueMedia.findFirst({
    where: {
      id: new URL(request.url).pathname.split("/")[3],
      ownerId: user.id,
    },
  });
  if (!media) throw new HttpError(404, "Фотография не найдена");
  await deletePhotos([media.key]);
  await db.issueMedia.delete({ where: { id: media.id } });
  return { deleted: true };
});
