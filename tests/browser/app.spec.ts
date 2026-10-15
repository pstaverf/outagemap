import { test, expect } from "@playwright/test";
test("map-first screen, filters and guest login preserve context", async ({
  page,
}) => {
  const workerErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("Worker failed"))
      workerErrors.push(message.text());
  });
  await page.goto("/");
  await expect(page.getByRole("link", { name: /OutageMap/ })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Сообщить о проблеме", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Сообщить о проблеме", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Email", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(workerErrors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("guests cannot mutate content and errors use the common envelope", async ({
  request,
}) => {
  const response = await request.post("/api/issues", {
    headers: {
      Origin: new URL(process.env.TEST_BASE_URL ?? "http://localhost:3000")
        .origin,
    },
    data: {},
  });
  expect(response.status()).toBe(401);
  expect(await response.json()).toMatchObject({ error: { code: "401" } });
  const csrf = await request.post("/api/reviews", {
    headers: { Origin: "https://untrusted.invalid" },
    data: {},
  });
  expect(csrf.status()).toBe(403);
});
test("location choice, language selection and security headers", async ({
  page,
}) => {
  const response = await page.goto("/");
  expect(response?.headers()["content-security-policy"]).toContain(
    "'strict-dynamic'",
  );
  await page
    .getByRole("button", { name: "Изменить", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Казань", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Казань");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Казань");
  await page
    .getByRole("combobox", { name: "Язык", exact: true })
    .selectOption("kk");
  await expect(
    page.getByRole("button", { name: "Мәселе туралы хабарлау", exact: true }),
  ).toBeVisible();
});
test("real authenticated issue lifecycle and IDOR protection", async ({
  request,
}) => {
  const origin = new URL(process.env.TEST_BASE_URL ?? "http://localhost:3000")
    .origin;
  const headers = {
    Origin: origin,
    Cookie: "authjs.session-token=local-integration-session",
  };
  const response = await request.post("/api/issues", {
    headers,
    data: {
      title: "Интеграционная проверка отключения",
      description:
        "Тестовое сообщение для проверки жизненного цикла в изолированной базе",
      category: "POWER",
      lat: 43.2,
      lng: 76.9,
      city: "Алматы",
      region: "Алматы",
      address: "Тестовая улица",
      mediaIds: [],
    },
  });
  expect(response.status()).toBe(200);
  const issue = (await response.json()) as { id: string };
  try {
    const foreignHeaders = {
      Origin: origin,
      Cookie: "authjs.session-token=other-integration-session",
    };
    const foreignEdit = await request.patch(`/api/issues/${issue.id}`, {
      headers: foreignHeaders,
      data: {
        title: "Попытка изменить чужую проблему",
        description: "Проверка защиты от изменения чужого контента",
        category: "POWER",
        lat: 43.2,
        lng: 76.9,
        city: "Алматы",
        region: "",
        address: "",
      },
    });
    expect(foreignEdit.status()).toBe(403);
    const foreignDelete = await request.delete(`/api/issues/${issue.id}`, {
      headers: foreignHeaders,
    });
    expect(foreignDelete.status()).toBe(404);
    const detail = await request.get(`/api/issues/${issue.id}`, { headers });
    expect(detail.ok()).toBe(true);
    const affected = await request.post(`/api/issues/${issue.id}/reaction`, {
      headers,
      data: { type: "AFFECTED" },
    });
    expect(affected.ok()).toBe(true);
    expect(await affected.json()).toMatchObject({ affected: 1 });
    const removed = await request.post(`/api/issues/${issue.id}/reaction`, {
      headers,
      data: { type: null },
    });
    expect(await removed.json()).toMatchObject({ affected: 0 });
    const forbidden = await request.post("/api/moderation", {
      headers,
      data: {
        action: "dismiss",
        reportId: "not-owned",
        reason: "Попытка изменения чужого контента",
      },
    });
    expect(forbidden.status()).toBe(403);
    const close = await request.post(`/api/issues/${issue.id}/moderate`, {
      headers,
      data: {
        status: "RESOLVED",
        reason: "Проверка закрытия автором сообщения",
      },
    });
    expect(close.ok()).toBe(true);
  } finally {
    const deleted = await request.delete(`/api/issues/${issue.id}`, {
      headers,
    });
    expect(deleted.ok()).toBe(true);
  }
});
