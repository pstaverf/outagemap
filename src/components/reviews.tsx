"use client";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Star } from "lucide-react";
import { api } from "@/lib/api";
import { reviewsSchema, reviewSchema } from "@/lib/schemas";
export function Reviews({
  city,
  onLogin,
}: {
  city: string;
  onLogin: () => void;
}) {
  const { data: session } = useSession();
  const client = useQueryClient();
  const [notice, setNotice] = useState("");
  const reviews = useQuery({
    queryKey: ["reviews", city],
    queryFn: () =>
      api(`/api/reviews?location=${encodeURIComponent(city)}`, reviewsSchema),
  });
  const {
    register,
    getValues,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof reviewSchema>>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { locationKey: city, rating: 5, text: "" },
  });
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`outagemap:review:${city}`);
      if (raw) {
        const draft = reviewSchema
          .extend({ text: z.string().max(2000) })
          .safeParse(JSON.parse(raw));
        if (draft.success) reset(draft.data);
      }
    } catch {
      sessionStorage.removeItem(`outagemap:review:${city}`);
    }
  }, [city, reset]);
  function loginWithDraft() {
    sessionStorage.setItem(
      `outagemap:review:${city}`,
      JSON.stringify(getValues()),
    );
    sessionStorage.setItem("outagemap:tab", "reviews");
    onLogin();
  }
  const submit = handleSubmit(async (data) => {
    if (!session) {
      loginWithDraft();
      return;
    }
    try {
      await api("/api/reviews", z.object({ id: z.string() }), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, locationKey: city }),
      });
      reset({ locationKey: city, rating: 5, text: "" });
      sessionStorage.removeItem(`outagemap:review:${city}`);
      sessionStorage.removeItem("outagemap:tab");
      setNotice("Отзыв опубликован");
      await client.invalidateQueries({ queryKey: ["reviews", city] });
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Не удалось отправить отзыв",
      );
    }
  });
  return (
    <section className="reviews-panel">
      <h2>Отзывы о местности</h2>
      <p className="rating-summary">
        <Star size={20} />
        {reviews.data?.summary._avg.rating?.toFixed(1) ?? "Нет оценок"}
        <span>
          {reviews.data?.summary._count ?? 0} отзывов · {city}
        </span>
      </p>
      {reviews.isPending ? (
        <p>Загружаем отзывы…</p>
      ) : reviews.isError ? (
        <button className="secondary" onClick={() => reviews.refetch()}>
          Повторить загрузку
        </button>
      ) : reviews.data.items.length ? (
        reviews.data.items.map((review) => (
          <article className="review-item" key={review.id}>
            <div>
              <Star size={14} />
              {review.rating}
              <time>{new Date(review.createdAt).toLocaleDateString("ru")}</time>
            </div>
            <p>{review.text}</p>
            <button
              className="text-button"
              onClick={async () => {
                if (!session) {
                  onLogin();
                  return;
                }
                const reason = window.prompt(
                  "Причина жалобы (не менее 10 символов)",
                );
                if (!reason) return;
                try {
                  await api(
                    `/api/reviews/${review.id}`,
                    z.object({ id: z.string() }),
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ reason }),
                    },
                  );
                  setNotice("Жалоба отправлена");
                } catch (error) {
                  setNotice(
                    error instanceof Error
                      ? error.message
                      : "Не удалось отправить",
                  );
                }
              }}
            >
              Пожаловаться
            </button>
          </article>
        ))
      ) : (
        <p>Здесь пока нет отзывов. Расскажите о своём районе.</p>
      )}
      <form className="form" onSubmit={submit}>
        <h3>Ваш отзыв</h3>
        <label>
          Оценка
          <select {...register("rating", { valueAsNumber: true })}>
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {value} из 5
              </option>
            ))}
          </select>
        </label>
        <label>
          Что важно знать соседям?
          <textarea {...register("text")} rows={4} />
        </label>
        {Object.entries(errors).map(([key, error]) => (
          <p role="alert" key={key} className="form-error">
            {error.message}
          </p>
        ))}
        {session ? (
          <button
            className="primary"
            disabled={isSubmitting}
            onClick={() => setValue("locationKey", city)}
          >
            Опубликовать
          </button>
        ) : (
          <button type="button" className="primary" onClick={loginWithDraft}>
            Войти и оставить отзыв
          </button>
        )}
        <p className="fine-print">Один отзыв на местность в сутки (UTC).</p>
      </form>
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
