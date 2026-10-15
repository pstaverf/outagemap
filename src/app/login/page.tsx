import Link from 'next/link';
import { signIn } from '@/server/auth';
export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  return <main className="auth-page"><Link href="/">← На карту</Link><h1>Войти в OutageMap</h1>{params.sent ? <p>Если адрес указан верно, ссылка для входа отправлена на почту. Она действует 15 минут.</p> : <><p>Войдите, чтобы сообщать о проблемах и подтверждать сообщения соседей.</p>{params.error && <p role="alert">Не удалось войти. Попробуйте запросить новую ссылку.</p>}<form action={async () => { 'use server'; await signIn('google', { redirectTo: '/' }); }}><button className="secondary">Продолжить с Google</button></form><form action={async form => { 'use server'; await signIn('nodemailer', { email: String(form.get('email')), redirectTo: '/' }); }}><label htmlFor="email">Электронная почта</label><input id="email" name="email" type="email" required maxLength={254} /><button className="primary">Получить ссылку для входа</button></form></>}</main>;
}
