import Link from "next/link";
export default function NotFound() {
  return (
    <main className="document">
      <h1>Страница не найдена</h1>
      <p>Возможно, сообщение было удалено или скрыто.</p>
      <Link href="/">Вернуться на карту</Link>
    </main>
  );
}
