import { z } from "zod";
export async function api<T>(
  url: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, init);
  const body: unknown = await response.json();
  if (!response.ok) {
    const error = z
      .object({ error: z.object({ message: z.string() }) })
      .safeParse(body);
    throw new Error(
      error.success ? error.data.error.message : "Не удалось выполнить запрос",
    );
  }
  return schema.parse(body);
}
