import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';
export const metadata: Metadata = { title: 'OutageMap — карта городских проблем', description: 'Сообщения жителей об отключениях и городских проблемах Казахстана и России.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ru"><body><Providers>{children}</Providers></body></html>; }
