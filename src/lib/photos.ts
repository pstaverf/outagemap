import { api } from "./api";
import { z } from "zod";
export async function uploadPhoto(file: File) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 8 * 1024 * 1024
  )
    throw new Error("Фото: JPEG, PNG или WebP до 8 МБ");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Не удалось обработать фотографию");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("Не удалось сжать фотографию")),
        "image/webp",
        0.82,
      ),
    );
    const signed = await api(
      "/api/media/sign",
      z.object({
        key: z.string(),
        url: z.url(),
        fields: z.record(z.string(), z.string()),
      }),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: blob.type, size: blob.size }),
      },
    );
    const form = new FormData();
    Object.entries(signed.fields).forEach(([key, value]) =>
      form.append(key, value),
    );
    form.append("file", blob, "photo.webp");
    const uploaded = await fetch(signed.url, { method: "POST", body: form });
    if (!uploaded.ok) throw new Error("Не удалось загрузить фотографию");
    return api("/api/media/finalize", z.object({ id: z.string() }), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: signed.key }),
    });
  } finally {
    bitmap.close();
  }
}
