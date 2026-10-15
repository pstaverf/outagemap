import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { distance } from "../src/lib/geo";
import {
  querySchema,
  emailSchema,
  createIssueSchema,
  geocodeResultSchema,
} from "../src/lib/schemas";
import {
  trustedIP,
  lookupLocation,
  encodeLocation,
  decodeLocation,
} from "../src/server/location";
test("shared validation and geospatial distance", () => {
  assert.equal(emailSchema.parse(" Person@EXAMPLE.com "), "person@example.com");
  assert.equal(
    emailSchema.safeParse("a＠example.com@attacker.com").success,
    false,
  );
  assert.equal(querySchema.safeParse({ south: 50, north: 40 }).success, false);
  assert.equal(
    createIssueSchema.safeParse({ title: "<script>" }).success,
    false,
  );
  assert.equal(distance(43.2, 76.9, 43.2, 76.9), 0);
  assert.ok(distance(43.2, 76.9, 43.201, 76.9) < 150);
  assert.ok(distance(43.2, 76.9, 43.202, 76.9) > 150);
});
test("geocoding accepts upstream strings and API numbers, rejecting invalid coordinates", () => {
  assert.equal(
    geocodeResultSchema.parse({
      lat: "43.2",
      lon: "76.9",
      display_name: "Алматы",
    }).lat,
    43.2,
  );
  assert.equal(
    geocodeResultSchema.parse({ lat: 43.2, lon: 76.9, display_name: "Алматы" })
      .lon,
    76.9,
  );
  assert.equal(
    geocodeResultSchema.safeParse({
      lat: null,
      lon: false,
      display_name: "Wrong",
    }).success,
    false,
  );
});
test("proxy trust and signed location cookies", async () => {
  process.env.AUTH_SECRET = "test-secret-not-for-deployment";
  process.env.TRUSTED_PROXY_SECRET = "trusted-test-proxy";
  assert.equal(trustedIP(new Headers({ "x-forwarded-for": "1.2.3.4" })), null);
  assert.equal(
    trustedIP(
      new Headers({
        "x-forwarded-for": "1.2.3.4, 5.6.7.8",
        "x-outagemap-proxy-secret": "trusted-test-proxy",
      }),
    ),
    "5.6.7.8",
  );
  const location = await lookupLocation(null);
  assert.equal(location.source, "fallback");
  const encoded = encodeLocation(location);
  assert.deepEqual(decodeLocation(encoded), location);
  assert.equal(decodeLocation(`${encoded}x`), null);
});
test(
  "PostgreSQL migrations, concurrent reactions, media ownership and cascades",
  { timeout: 90000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "outagemap-test-"));
    const postgres = new EmbeddedPostgres({
      databaseDir: join(directory, "db"),
      user: "outagemap",
      password: "test-password",
      port: 15439,
      persistent: false,
      onLog: () => undefined,
      onError: () => undefined,
    });
    let client: PrismaClient | undefined;
    try {
      await postgres.initialise();
      await postgres.start();
      await postgres.createDatabase("outagemap");
      const pg = postgres.getPgClient("outagemap");
      await pg.connect();
      try {
        for (const migration of (await readdir("prisma/migrations"))
          .filter((name) => /^\d/.test(name))
          .sort())
          await pg.query(
            await readFile(
              `prisma/migrations/${migration}/migration.sql`,
              "utf8",
            ),
          );
      } finally {
        await pg.end();
      }
      const url =
        "postgresql://outagemap:test-password@localhost:15439/outagemap";
      process.env.DATABASE_URL = url;
      client = new PrismaClient({
        adapter: new PrismaPg({ connectionString: url }),
      });
      const { db } = await import("../src/server/db");
      const { react, createIssue, nearby, listIssues } =
        await import("../src/server/issues");
      const author = await client.user.create({
        data: { email: "author@example.com" },
      });
      const users = await Promise.all(
        [1, 2, 3].map((n) =>
          client!.user.create({ data: { email: `resident${n}@example.com` } }),
        ),
      );
      const fields = {
        title: "Отключение электричества",
        description: "Нет электричества в нескольких домах",
        category: "POWER" as const,
        lat: 43.2,
        lng: 76.9,
        city: "Алматы",
        region: "Алматы",
        address: "Улица Абая",
      };
      const issue = await createIssue({ ...fields, mediaIds: [] }, author.id);
      await Promise.all(
        users.map((user) => react(issue.id, user.id, "AFFECTED")),
      );
      assert.equal(
        (await client.issue.findUniqueOrThrow({ where: { id: issue.id } }))
          .status,
        "CONFIRMED",
      );
      await Promise.all(
        Array.from({ length: 8 }, () =>
          react(issue.id, users[0].id, "AFFECTED"),
        ),
      );
      assert.equal(
        await client.reaction.count({ where: { issueId: issue.id } }),
        3,
      );
      await react(issue.id, users[0].id, "NOT_AFFECTED");
      const counts = await react(issue.id, users[1].id, null);
      assert.equal(counts.affected, 1);
      assert.equal(counts.notAffected, 1);
      assert.equal(
        (await client.issue.findUniqueOrThrow({ where: { id: issue.id } }))
          .status,
        "OPEN",
      );
      assert.equal((await nearby(43.2, 76.9)).length, 1);
      assert.equal((await nearby(43.21, 76.9)).length, 0);
      assert.equal(
        (
          await listIssues({
            west: 76,
            east: 77,
            south: 43,
            north: 44,
            sort: "affected",
          })
        ).items.length,
        1,
      );
      const photo = await client.issueMedia.create({
        data: { key: "test.webp", ownerId: users[0].id },
      });
      await assert.rejects(() =>
        createIssue({ ...fields, mediaIds: [photo.id] }, author.id),
      );
      const day = new Date("2026-10-15");
      await client.review.create({
        data: {
          locationKey: "Алматы",
          rating: 5,
          text: "Чистый и спокойный район",
          day,
          authorId: author.id,
        },
      });
      await assert.rejects(() =>
        client!.review.create({
          data: {
            locationKey: "Алматы",
            rating: 3,
            text: "Вторая оценка в тот же день",
            day,
            authorId: author.id,
          },
        }),
      );
      await client.auditLog.create({
        data: { actorId: author.id, action: "test", targetId: issue.id },
      });
      await client.user.delete({ where: { id: author.id } });
      assert.equal(await client.issue.count(), 0);
      assert.equal(await client.reaction.count(), 0);
      assert.equal(await client.review.count(), 0);
      assert.equal((await client.auditLog.findFirstOrThrow()).actorId, null);
      await db.$disconnect();
    } finally {
      await client?.$disconnect();
      await postgres.stop();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
