import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { sameOrigin } from "../src/lib/origin";
import { endpoint, parseBody } from "../src/server/http";
test("same-origin checks use the browser host, not the internal Next bind address", () => {
  assert.equal(
    sameOrigin(
      new Request("http://0.0.0.0:3000/api/issues", {
        headers: { Host: "example.org", Origin: "https://example.org" },
      }),
    ),
    true,
  );
  assert.equal(
    sameOrigin(
      new Request("http://0.0.0.0:3000/api/issues", {
        headers: { Host: "example.org", Origin: "https://evil.example" },
      }),
    ),
    false,
  );
  assert.equal(sameOrigin(new Request("http://example.org/api/issues")), false);
});
test("JSON transport rejects oversized bodies, wrong MIME and invalid JSON", async () => {
  const handler = endpoint(async (request) =>
    parseBody(request, z.object({ title: z.string() })),
  );
  const valid = await handler(
    new Request("http://localhost/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Валидный запрос" }),
    }),
  );
  assert.equal(valid.status, 200);
  const huge = await handler(
    new Request("http://localhost/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "x".repeat(70000) }),
    }),
  );
  assert.equal(huge.status, 413);
  const mime = await handler(
    new Request("http://localhost/api", { method: "POST", body: "invalid" }),
  );
  assert.equal(mime.status, 415);
  const json = await handler(
    new Request("http://localhost/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    }),
  );
  assert.equal(json.status, 400);
  assert.deepEqual(await json.json(), {
    error: { code: "400", message: "Проверьте введённые данные" },
  });
});
