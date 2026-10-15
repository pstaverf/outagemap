import EmbeddedPostgres from "embedded-postgres";
import { readFile, readdir } from "node:fs/promises";
import { db } from "../src/server/db";
const postgres = new EmbeddedPostgres({
  databaseDir: "./data/test-postgres",
  user: "outagemap",
  password: "outagemap",
  port: 15432,
  persistent: false,
  onLog: () => undefined,
});
async function start() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.DATABASE_URL !==
      "postgresql://outagemap:outagemap@localhost:15432/outagemap"
  )
    throw new Error("Isolated local test database configuration required");
  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase("outagemap");
  const pg = postgres.getPgClient("outagemap");
  await pg.connect();
  for (const migration of (await readdir("prisma/migrations"))
    .filter((name) => /^\d/.test(name))
    .sort())
    await pg.query(
      await readFile(`prisma/migrations/${migration}/migration.sql`, "utf8"),
    );
  await pg.end();
  const user = await db.user.create({
    data: {
      email: "e2e@example.invalid",
      name: "Integration test user",
      emailVerified: new Date(),
    },
  });
  await db.session.create({
    data: {
      userId: user.id,
      sessionToken: "local-integration-session",
      expires: new Date(Date.now() + 3600000),
    },
  });
  const other = await db.user.create({
    data: { email: "other@example.invalid" },
  });
  await db.session.create({
    data: {
      userId: other.id,
      sessionToken: "other-integration-session",
      expires: new Date(Date.now() + 3600000),
    },
  });
  process.stdout.write("Test database ready on 15432\n");
}
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await db.$disconnect();
  await postgres.stop();
  process.exit(0);
}
process.on("SIGTERM", () => void stop());
process.on("SIGINT", () => void stop());
start().catch(async () => {
  process.stderr.write("Test database startup failed\n");
  await stop();
});
