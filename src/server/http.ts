import { sameOrigin } from "@/lib/origin";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "./auth";
import { db } from "./db";
import { limit } from "./redis";
import { trustedIP } from "./location";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function actor(request: Request) {
  if (!sameOrigin(request))
    throw new HttpError(403, "Источник запроса не разрешён");
  const session = await auth();
  if (!session?.user?.id) throw new HttpError(401, "Войдите, чтобы продолжить");
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.blocked) throw new HttpError(403, "Доступ ограничен");
  await limit(`write:${user.id}`, 30);
  const ip = trustedIP(request.headers);
  if (ip) await limit(`write-ip:${ip}`, 60);
  return user;
}
export function endpoint(handler: (request: Request) => Promise<unknown>) {
  return async (request: Request) => {
    try {
      return NextResponse.json(await handler(request), {
        headers: { "Cache-Control": "private, no-store" },
      });
    } catch (error) {
      const status =
        error instanceof SyntaxError
          ? 400
          : error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === "P2025"
            ? 404
            : error instanceof HttpError
              ? error.status
              : error instanceof ZodError
                ? 400
                : error instanceof Prisma.PrismaClientKnownRequestError &&
                    error.code === "P2002"
                  ? 409
                  : error instanceof Error && error.message === "RATE_LIMIT"
                    ? 429
                    : 503;
      const message =
        error instanceof HttpError
          ? error.message
          : status === 400
            ? "Проверьте введённые данные"
            : status === 404
              ? "Запись не найдена"
              : status === 409
                ? "Такая запись уже существует"
                : status === 429
                  ? "Слишком много запросов. Попробуйте позже"
                  : "Сервис временно недоступен";
      return NextResponse.json(
        { error: { code: String(status), message } },
        { status },
      );
    }
  };
}
export async function parseBody<T>(
  request: Request,
  schema: import("zod").ZodType<T>,
): Promise<T> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new HttpError(415, "Ожидается JSON");
  if (!request.body) throw new HttpError(400, "Тело запроса отсутствует");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) {
        await reader.cancel();
        throw new HttpError(413, "Слишком большой запрос");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const buffer = Buffer.concat(chunks, size);
  return schema.parse(
    JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer)),
  );
}
