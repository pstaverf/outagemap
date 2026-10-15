"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  issueSchema,
  categories,
  issueViewSchema,
  type IssueInput,
} from "@/lib/schemas";
import { api } from "@/lib/api";
import { uploadPhoto } from "@/lib/photos";
import { z } from "zod";
export function CreateForm({
  point,
  city,
  onDone,
}: {
  point: [number, number];
  city: string;
  onDone: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const duplicates = useQuery({
    queryKey: ["nearby", ...point],
    queryFn: () =>
      api(
        `/api/issues/nearby?lat=${point[0]}&lng=${point[1]}`,
        z.object({ items: z.array(issueViewSchema) }),
      ),
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<IssueInput>({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      lat: point[0],
      lng: point[1],
      category: "POWER",
      city,
      region: "",
      address: "",
    },
  });
  const submit = handleSubmit(async (data) => {
    if (!duplicates.isSuccess) {
      setError("root", {
        message: "Сначала дождитесь проверки похожих проблем",
      });
      return;
    }
    if (duplicates.data.items.length && !acknowledged) {
      setError("root", {
        message: "Проверьте похожие проблемы перед публикацией",
      });
      return;
    }
    try {
      const ids = [...mediaIds];
      for (let i = ids.length; i < files.length; i++) {
        const media = await uploadPhoto(files[i]);
        ids.push(media.id);
        setMediaIds([...ids]);
      }
      await api("/api/issues", z.object({ id: z.string() }), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, mediaIds: ids }),
      });
      onDone();
    } catch (error) {
      setError("root", {
        message:
          error instanceof Error ? error.message : "Не удалось отправить",
      });
    }
  });
  return (
    <form onSubmit={submit} className="form">
      <p className="muted">
        Точка на карте: {point[0].toFixed(5)}, {point[1].toFixed(5)}
      </p>
      <section className="duplicates">
        <h3>Похожие проблемы в радиусе 150 м</h3>
        {duplicates.isPending ? (
          <p>Проверяем сообщения соседей…</p>
        ) : duplicates.isError ? (
          <>
            <p role="alert">Проверка недоступна</p>
            <button
              type="button"
              className="secondary"
              onClick={() => duplicates.refetch()}
            >
              Повторить
            </button>
          </>
        ) : duplicates.data.items.length ? (
          <>
            {duplicates.data.items.map((issue) => (
              <Link target="_blank" key={issue.id} href={`/issues/${issue.id}`}>
                {issue.title} ↗
              </Link>
            ))}
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
              />
              Это другая проблема
            </label>
          </>
        ) : (
          <p>Похожих сообщений пока нет</p>
        )}
      </section>
      <label>
        Что произошло?
        <input
          {...register("title")}
          placeholder="Например, нет электричества в доме"
        />
      </label>
      <label>
        Категория
        <select {...register("category")}>
          {Object.entries(categories).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Описание
        <textarea
          {...register("description")}
          rows={4}
          placeholder="Когда началось и какие дома затронуты?"
        />
      </label>
      <div className="form-grid">
        <label>
          Город
          <input {...register("city")} />
        </label>
        <label>
          Регион
          <input {...register("region")} />
        </label>
      </div>
      <label>
        Адрес
        <input {...register("address")} placeholder="Улица и номер дома" />
      </label>
      <label>
        Фотографии: до 5, не более 8 МБ каждая
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={isSubmitting || mediaIds.length > 0}
          onChange={(e) => {
            const chosen = Array.from(e.target.files ?? []);
            if (chosen.length > 5) {
              setError("root", {
                message: "Можно добавить не более пяти фотографий",
              });
              e.target.value = "";
              return;
            }
            setFiles(chosen);
          }}
        />
      </label>
      {files.map((file) => (
        <p className="fine-print" key={file.name}>
          {file.name}
        </p>
      ))}
      {Object.entries(errors).map(([key, error]) => (
        <p role="alert" className="form-error" key={key}>
          {error.message}
        </p>
      ))}
      <button
        className="primary"
        disabled={isSubmitting || !duplicates.isSuccess}
      >
        {isSubmitting ? "Публикуем…" : "Опубликовать проблему"}
      </button>
      <p className="fine-print">
        Фотографии сжимаются; сервер удаляет метаданные. Не указывайте
        персональные данные других людей.
      </p>
    </form>
  );
}
