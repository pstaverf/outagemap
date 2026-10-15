import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { auth } from './auth';
import { db } from './db';
import { limit } from './redis';
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function actor(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) throw new HttpError(403, 'Источник запроса не разрешён');
  const session = await auth();
  if (!session?.user?.id) throw new HttpError(401, 'Войдите, чтобы продолжить');
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.blocked) throw new HttpError(403, 'Доступ ограничен');
  await limit(`write:${user.id}`, 30);
  return user;
}
export function endpoint(handler: (request: Request) => Promise<unknown>) {
  return async (request: Request) => {
    try { return NextResponse.json(await handler(request)); }
    catch (error) {
      const status = error instanceof HttpError ? error.status : error instanceof ZodError ? 400 : error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' ? 409 : error instanceof Error && error.message === 'RATE_LIMIT' ? 429 : 503;
      const message = error instanceof HttpError ? error.message : status === 400 ? 'Проверьте введённые данные' : status === 409 ? 'Такая запись уже существует' : status === 429 ? 'Слишком много запросов. Попробуйте позже' : 'Сервис временно недоступен';
      return NextResponse.json({ error: { code: String(status), message } }, { status });
    }
  };
}
