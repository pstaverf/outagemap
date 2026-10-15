"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { api } from "@/lib/api";
export function ModerationActions({
  reportId,
  issueId,
  reviewId,
  authorId,
}: {
  reportId: string;
  issueId: string | null;
  reviewId: string | null;
  authorId: string | undefined;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(body: unknown, url = "/api/moderation") {
    if (reason.trim().length < 10) {
      setError("Укажите основание от 10 символов");
      return;
    }
    setBusy(true);
    try {
      await api(url, z.object({}).passthrough(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Действие не выполнено",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="form">
      <label>
        Основание действия
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          minLength={10}
          maxLength={1000}
        />
      </label>
      <div className="moderation-buttons">
        {issueId && (
          <>
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                submit(
                  { status: "REJECTED", reason },
                  `/api/issues/${issueId}/moderate`,
                )
              }
            >
              Скрыть
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                submit(
                  { status: "RESOLVED", reason },
                  `/api/issues/${issueId}/moderate`,
                )
              }
            >
              Закрыть дубликат
            </button>
          </>
        )}
        {reviewId && (
          <button
            className="secondary"
            disabled={busy}
            onClick={() => submit({ action: "hide-review", reviewId, reason })}
          >
            Скрыть отзыв
          </button>
        )}
        {authorId && (
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              submit({
                action: "block",
                userId: authorId,
                blocked: true,
                reason,
              })
            }
          >
            Заблокировать автора
          </button>
        )}
        <button
          className="secondary"
          disabled={busy}
          onClick={() => submit({ action: "dismiss", reportId, reason })}
        >
          Отклонить жалобу
        </button>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
