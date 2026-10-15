import Redis from 'ioredis';
import { createHmac } from 'node:crypto';
export const redis = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', { lazyConnect: true, maxRetriesPerRequest: 1 });
redis.on('error', () => undefined);
export async function limit(key: string, maximum: number, seconds = 60) {
  const digest = createHmac('sha256', process.env.AUTH_SECRET ?? 'local-development-only').update(key).digest('hex');
  const count = await redis.eval("local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return n", 1, `limit:${digest}`, seconds);
  if (Number(count) > maximum) throw new Error('RATE_LIMIT');
}
