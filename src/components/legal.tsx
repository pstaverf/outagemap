import Link from "next/link";
export function Legal({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="document">
      <Link href="/">← На карту</Link>
      <h1>{title}</h1>
      <p className="muted">Редакция от 15 октября 2026 года</p>
      {children}
      <h2>Оператор и обращения</h2>
      {process.env.OPERATOR_NAME && process.env.OPERATOR_CONTACT ? (
        <p>
          {process.env.OPERATOR_NAME}. Обращения по персональным данным:{" "}
          <a href={`mailto:${process.env.OPERATOR_CONTACT}`}>
            {process.env.OPERATOR_CONTACT}
          </a>
          .
        </p>
      ) : (
        <p role="alert">
          Реквизиты оператора ещё не настроены. Публичный сбор персональных
          данных до их заполнения не допускается.
        </p>
      )}
      <p>
        Юрисдикция этого экземпляра:{" "}
        {process.env.DATA_JURISDICTION === "RU"
          ? "Российская Федерация"
          : "Республика Казахстан"}
        . Оператор обязан подтвердить соответствие фактического размещения БД,
        файлов и резервных копий указанной юрисдикции.
      </p>
      {process.env.RU_PUBLIC_URL && (
        <p>
          <a href={process.env.RU_PUBLIC_URL}>Российский экземпляр сервиса</a>
        </p>
      )}
      {process.env.KZ_PUBLIC_URL && (
        <p>
          <a href={process.env.KZ_PUBLIC_URL}>
            Казахстанский экземпляр сервиса
          </a>
        </p>
      )}
      <nav>
        <Link href="/privacy">Конфиденциальность</Link> ·{" "}
        <Link href="/terms">Правила</Link> · <Link href="/cookies">Cookie</Link>
      </nav>
    </main>
  );
}
