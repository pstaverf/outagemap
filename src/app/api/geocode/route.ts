import { endpoint, HttpError } from '@/server/http';
import { redis } from '@/server/redis';
import { z } from 'zod';
const results = z.array(z.object({ lat: z.string(), lon: z.string(), display_name: z.string() }));
export const GET = endpoint(async request => {
  const q = z.string().trim().min(3).max(150).parse(new URL(request.url).searchParams.get('q'));
  const key = `geocode:${q.toLowerCase()}`;
  const cached = await redis.get(key);
  if (cached) return results.parse(JSON.parse(cached));
  if (!await redis.set('nominatim:lock', '1', 'EX', 1, 'NX')) throw new HttpError(429, 'Повторите поиск через секунду');
  const url = new URL('/search', process.env.NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org');
  url.search = new URLSearchParams({ q, format: 'jsonv2', limit: '5', countrycodes: 'kz,ru', 'accept-language': 'ru' }).toString();
  const response = await fetch(url, { headers: { 'User-Agent': process.env.GEOCODER_USER_AGENT ?? 'OutageMap/1.0' }, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new HttpError(503, 'Поиск адресов недоступен');
  const data = results.parse(await response.json());
  await redis.set(key, JSON.stringify(data), 'EX', 86400);
  return data;
});
