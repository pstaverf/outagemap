"use client";
import Link from "next/link";
import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MapPin,
  ShieldCheck,
  ThumbsUp,
  X,
} from "lucide-react";
import { z } from "zod";
import { api } from "@/lib/api";
import { issueDetailSchema, statuses } from "@/lib/schemas";
export function IssueDetail({
  id,
  onClose,
  onLogin,
  notify,
}: {
  id: string;
  onClose: () => void;
  onLogin: () => void;
  notify: (text: string) => void;
}) {
  const { data: session } = useSession();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const key = ["issue", id, session?.user?.id];
  const query = useQuery({
    queryKey: key,
    queryFn: () => api(`/api/issues/${id}`, issueDetailSchema),
  });
  async function react(
    type: "AFFECTED" | "NOT_AFFECTED" | null,
    resume = false,
  ) {
    if (!session) {
      sessionStorage.setItem(
        "outagemap:reaction",
        JSON.stringify({ id, type }),
      );
      onLogin();
      return;
    }
    if (!query.data || busy) return;
    const previous = query.data;
    const next = !resume && previous.myReaction === type ? null : type;
    setBusy(true);
    client.setQueryData(key, {
      ...previous,
      myReaction: next,
      affected:
        previous.affected -
        (previous.myReaction === "AFFECTED" ? 1 : 0) +
        (next === "AFFECTED" ? 1 : 0),
      notAffected:
        previous.notAffected -
        (previous.myReaction === "NOT_AFFECTED" ? 1 : 0) +
        (next === "NOT_AFFECTED" ? 1 : 0),
    });
    try {
      await api(
        `/api/issues/${id}/reaction`,
        z.object({ affected: z.number(), notAffected: z.number() }),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: next }),
        },
      );
      await client.invalidateQueries({ queryKey: ["issues"] });
      await client.invalidateQueries({ queryKey: ["issue", id] });
    } catch (error) {
      client.setQueryData(key, previous);
      notify(
        error instanceof Error ? error.message : "Не удалось сохранить реакцию",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!session || !query.isSuccess) return;
    const raw = sessionStorage.getItem("outagemap:reaction");
    if (!raw) return;
    try {
      const pending = z
        .object({
          id: z.string(),
          type: z.enum(["AFFECTED", "NOT_AFFECTED"]).nullable(),
        })
        .parse(JSON.parse(raw));
      if (pending.id === id) {
        sessionStorage.removeItem("outagemap:reaction");
        void react(pending.type, true);
      }
    } catch {
      sessionStorage.removeItem("outagemap:reaction");
    }
  });
  if (query.isPending)
    return (
      <article className="detail-panel">
        <p>Загружаем проблему…</p>
      </article>
    );
  if (!query.data)
    return (
      <article className="detail-panel">
        <p role="alert">Не удалось открыть проблему</p>
        <button className="secondary" onClick={onClose}>
          Закрыть
        </button>
      </article>
    );
  const issue = query.data;
  return (
    <article className="detail-panel">
      <button className="back-button" onClick={onClose}>
        <ArrowLeft size={16} />К списку проблем
        <X size={16} />
      </button>
      <span className={`status-badge ${issue.status.toLowerCase()}`}>
        <span />
        {statuses[issue.status]}
      </span>
      <h2>{issue.title}</h2>
      <p className="muted">
        <MapPin size={14} />
        {issue.address || issue.city}
      </p>
      <p className="detail-description">{issue.description}</p>
      <div className="photo-strip">
        {issue.mediaIds.map((mediaId) => (
          <a
            key={mediaId}
            target="_blank"
            rel="noreferrer"
            href={`/api/media/${mediaId}`}
          >
            <Image
              src={`/api/media/${mediaId}`}
              alt="Фото проблемы"
              width={132}
              height={100}
              unoptimized
            />
          </a>
        ))}
      </div>
      <div className="confirmation">
        <ShieldCheck size={18} />
        <div>
          <b>{issue.affected} жителей подтверждают</b>
          <p>
            {issue.affected + issue.notAffected
              ? Math.round(
                  (issue.affected / (issue.affected + issue.notAffected)) * 100,
                )
              : 0}
            % отметившихся затронула проблема
          </p>
        </div>
      </div>
      <div className="reaction-buttons">
        <button
          className={issue.myReaction === "AFFECTED" ? "primary" : "secondary"}
          aria-pressed={issue.myReaction === "AFFECTED"}
          disabled={busy || issue.status === "RESOLVED"}
          onClick={() => react("AFFECTED")}
        >
          <ThumbsUp size={16} />У меня тоже
        </button>
        <button
          className={
            issue.myReaction === "NOT_AFFECTED" ? "primary" : "secondary"
          }
          aria-pressed={issue.myReaction === "NOT_AFFECTED"}
          disabled={busy || issue.status === "RESOLVED"}
          onClick={() => react("NOT_AFFECTED")}
        >
          <Check size={16} />У меня работает
        </button>
      </div>
      <p className="fine-print">Нажмите повторно, чтобы снять свою реакцию.</p>
      {issue.canManage && issue.status !== "RESOLVED" && (
        <div className="resolve-box">
          {issue.suggestResolve && (
            <p>
              Соседи сообщают, что услуга работает. Возможно, проблема решена?
            </p>
          )}
          <button
            className="secondary"
            onClick={async () => {
              try {
                await api(
                  `/api/issues/${id}/moderate`,
                  z.object({ id: z.string() }),
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      status: "RESOLVED",
                      reason: "Проблема решена, работа услуги восстановлена",
                    }),
                  },
                );
                await client.invalidateQueries({ queryKey: ["issue", id] });
                await client.invalidateQueries({ queryKey: ["issues"] });
              } catch (error) {
                notify(
                  error instanceof Error
                    ? error.message
                    : "Не удалось закрыть проблему",
                );
              }
            }}
          >
            Отметить решённой
          </button>
        </div>
      )}
      <Link className="detail-link" href={`/issues/${id}`}>
        Страница проблемы <ArrowRight size={14} />
      </Link>
      <button
        className="text-button"
        onClick={async () => {
          if (!session) {
            onLogin();
            return;
          }
          const reason = window.prompt("Причина жалобы (не менее 10 символов)");
          if (!reason) return;
          try {
            await api(
              `/api/issues/${id}/report`,
              z.object({ id: z.string() }),
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason }),
              },
            );
            notify("Жалоба отправлена");
          } catch (error) {
            notify(
              error instanceof Error
                ? error.message
                : "Не удалось отправить жалобу",
            );
          }
        }}
      >
        Пожаловаться
      </button>
    </article>
  );
}
