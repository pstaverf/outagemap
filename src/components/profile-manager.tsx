"use client";
import Link from "next/link";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { z } from "zod";
import { api } from "@/lib/api";
import { issueSchema, categories, reviewSchema } from "@/lib/schemas";
import type { Issue, Review } from "@prisma/client";
export function ProfileManager({
  name,
  issues,
  reviews,
}: {
  name: string;
  issues: Issue[];
  reviews: Review[];
}) {
  const [notice, setNotice] = useState("");
  async function run(action: () => Promise<unknown>) {
    try {
      await action();
      setNotice("Сохранено");
      window.location.reload();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Не удалось выполнить действие",
      );
    }
  }
  async function remove(url: string) {
    if (!window.confirm("Удалить без возможности восстановления?")) return;
    await run(() =>
      api(url, z.object({ deleted: z.boolean() }), { method: "DELETE" }),
    );
  }
  return (
    <>
      <section>
        <h2>Настройки</h2>
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            void run(() =>
              api("/api/profile", z.object({ updated: z.boolean() }), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: data.get("name") }),
              }),
            );
          }}
        >
          <label>
            Имя
            <input
              name="name"
              defaultValue={name}
              minLength={2}
              maxLength={100}
              required
            />
          </label>
          <button className="secondary">Сохранить</button>
        </form>
      </section>
      <h2>Мои проблемы</h2>
      {issues.length ? (
        issues.map((issue) => (
          <article key={issue.id} className="profile-item">
            <Link href={`/issues/${issue.id}`}>{issue.title}</Link>
            <details>
              <summary>Редактировать</summary>
              <form
                className="form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const parsed = issueSchema.safeParse({
                    title: form.get("title"),
                    description: form.get("description"),
                    category: form.get("category"),
                    lat: issue.lat,
                    lng: issue.lng,
                    city: form.get("city"),
                    region: form.get("region"),
                    address: form.get("address"),
                  });
                  if (!parsed.success) {
                    setNotice(
                      "Проверьте поля: заголовок от 5, описание от 15 символов",
                    );
                    return;
                  }
                  void run(() =>
                    api(
                      `/api/issues/${issue.id}`,
                      z.object({ updated: z.boolean() }),
                      {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(parsed.data),
                      },
                    ),
                  );
                }}
              >
                <label>
                  Заголовок
                  <input name="title" defaultValue={issue.title} required />
                </label>
                <label>
                  Описание
                  <textarea
                    name="description"
                    defaultValue={issue.description}
                    required
                  />
                </label>
                <label>
                  Категория
                  <select name="category" defaultValue={issue.category}>
                    {Object.entries(categories).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Город
                  <input name="city" defaultValue={issue.city} required />
                </label>
                <label>
                  Регион
                  <input name="region" defaultValue={issue.region} />
                </label>
                <label>
                  Адрес
                  <input name="address" defaultValue={issue.address} />
                </label>
                <button className="primary">Сохранить изменения</button>
              </form>
            </details>
            <button
              className="text-button"
              onClick={() => remove(`/api/issues/${issue.id}`)}
            >
              Удалить проблему
            </button>
          </article>
        ))
      ) : (
        <p>Пока нет сообщений.</p>
      )}
      <h2>Мои отзывы</h2>
      {reviews.length ? (
        reviews.map((review) => (
          <article key={review.id} className="profile-item">
            <h3>
              {review.locationKey} · {review.rating}/5
              {review.hidden ? " · скрыт" : ""}
            </h3>
            <p>{review.text}</p>
            <details>
              <summary>Редактировать</summary>
              <form
                className="form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const parsed = reviewSchema
                    .pick({ rating: true, text: true })
                    .safeParse({
                      text: form.get("text"),
                      rating: Number(form.get("rating")),
                    });
                  if (!parsed.success) {
                    setNotice("Проверьте оценку и текст отзыва");
                    return;
                  }
                  void run(() =>
                    api(
                      `/api/reviews/${review.id}`,
                      z.object({ updated: z.boolean() }),
                      {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(parsed.data),
                      },
                    ),
                  );
                }}
              >
                <label>
                  Оценка
                  <input
                    name="rating"
                    type="number"
                    min={1}
                    max={5}
                    defaultValue={review.rating}
                    required
                  />
                </label>
                <label>
                  Текст
                  <textarea
                    name="text"
                    defaultValue={review.text}
                    required
                    minLength={10}
                    maxLength={2000}
                  />
                </label>
                <button className="primary">Сохранить отзыв</button>
              </form>
            </details>
            <button
              className="text-button"
              onClick={() => remove(`/api/reviews/${review.id}`)}
            >
              Удалить отзыв
            </button>
          </article>
        ))
      ) : (
        <p>Вы пока не оставляли отзывов.</p>
      )}
      <h2>Ваши данные</h2>
      <button
        className="secondary"
        onClick={async () => {
          try {
            const data = await api(
              "/api/profile",
              z.record(z.string(), z.unknown()),
              { method: "POST" },
            );
            const url = URL.createObjectURL(
              new Blob([JSON.stringify(data, null, 2)], {
                type: "application/json",
              }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = "outagemap-data.json";
            link.click();
            URL.revokeObjectURL(url);
          } catch (error) {
            setNotice(
              error instanceof Error ? error.message : "Выгрузка недоступна",
            );
          }
        }}
      >
        Скачать данные
      </button>
      <button
        className="secondary"
        onClick={async () => {
          if (
            !window.confirm(
              "Удалить аккаунт и все свои сообщения, отзывы и реакции?",
            )
          )
            return;
          try {
            await api("/api/profile", z.object({ deleted: z.boolean() }), {
              method: "DELETE",
            });
            await signOut({ callbackUrl: "/" });
          } catch (error) {
            setNotice(
              error instanceof Error ? error.message : "Удаление не удалось",
            );
          }
        }}
      >
        Удалить аккаунт
      </button>
      <p role="status">{notice}</p>
    </>
  );
}
