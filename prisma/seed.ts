import { db } from '../src/server/db';
async function seed() {
  if (process.env.ALLOW_DEMO_SEED !== 'true' || process.env.NODE_ENV === 'production') throw new Error('Seed requires ALLOW_DEMO_SEED=true outside production');
  const user = await db.user.upsert({ where: { email: 'development-seed@example.invalid' }, create: { email: 'development-seed@example.invalid', name: 'Учебные сообщения' }, update: {} });
  const places = [
    { city: 'Алматы', region: 'Алматы', lat: 43.2389, lng: 76.8897, address: 'Проспект Абая', category: 'POWER' as const, title: 'Учебный пример: отключение света', description: 'Демонстрационное сообщение для локальной разработки. Не отражает реальное отключение.' },
    { city: 'Астана', region: 'Астана', lat: 51.1282, lng: 71.4304, address: 'Проспект Кабанбай батыра', category: 'LIGHTING' as const, title: 'Учебный пример: уличное освещение', description: 'Демонстрация сообщения об освещении. Не является реальным обращением жителя.' },
    { city: 'Москва', region: 'Москва', lat: 55.7512, lng: 37.6184, address: 'Тверская улица', category: 'WATER' as const, title: 'Учебный пример: отключение воды', description: 'Учебная запись для проверки фильтров и отображения карты. Реального отключения не заявляет.' },
    { city: 'Казань', region: 'Татарстан', lat: 55.7903, lng: 49.1347, address: 'Улица Баумана', category: 'ROAD' as const, title: 'Учебный пример: дорожная проблема', description: 'Учебное сообщение о состоянии дороги для локального тестирования приложения.' }
  ];
  for (const [index, place] of places.entries()) await db.issue.upsert({ where: { id: `development-seed-${index}` }, create: { id: `development-seed-${index}`, ...place, authorId: user.id }, update: place });
  process.stdout.write('Inserted clearly labelled development-only examples\n');
}
seed().catch(() => { process.stderr.write('Seed failed: enable ALLOW_DEMO_SEED only in development\n'); process.exitCode = 1; }).finally(() => db.$disconnect());
