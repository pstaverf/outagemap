'use client';
import Link from 'next/link';
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="document"><h1>Не удалось открыть страницу</h1><p>Сервис временно недоступен. Попробуйте ещё раз немного позже.</p><button className="primary" onClick={reset}>Повторить</button><Link href="/">На карту</Link></main>; }
