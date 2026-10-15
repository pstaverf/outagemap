import Link from "next/link";
import { login } from "@/server/login";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const returnTo =
    params.callbackUrl?.startsWith("/") && !params.callbackUrl.startsWith("//")
      ? params.callbackUrl
      : "/";
  return (
    <main className="auth-page">
      <Link href="/">← На карту</Link>
      <h1>Войти в OutageMap</h1>
      {params.sent ? (
        <p>
          Если адрес указан верно, ссылка для входа отправлена на почту. Она
          действует 15 минут.
        </p>
      ) : (
        <>
          <p>
            Войдите, чтобы сообщать о проблемах и подтверждать сообщения
            соседей.
          </p>
          {params.error && (
            <p role="alert">
              Вход не выполнен. Проверьте адрес или запросите новую ссылку
              немного позже.
            </p>
          )}
          <form action={login}>
            <input name="provider" type="hidden" value="google" />
            <input name="returnTo" type="hidden" value={returnTo} />
            <label className="checkbox-label">
              <input type="checkbox" name="remember" />
              Запомнить на 30 дней
            </label>
            <button className="secondary">Продолжить с Google</button>
          </form>
          <form action={login}>
            <input name="provider" type="hidden" value="nodemailer" />
            <input name="returnTo" type="hidden" value={returnTo} />
            <label htmlFor="email">Электронная почта</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              maxLength={254}
            />
            <label className="checkbox-label">
              <input type="checkbox" name="remember" />
              Запомнить на 30 дней
            </label>
            <button className="primary">Получить ссылку для входа</button>
          </form>
          <p className="fine-print">
            Продолжая, вы принимаете <Link href="/terms">правила сервиса</Link>{" "}
            и <Link href="/privacy">политику конфиденциальности</Link>.
          </p>
        </>
      )}
    </main>
  );
}
