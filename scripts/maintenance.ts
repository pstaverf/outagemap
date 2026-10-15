import { db } from "../src/server/db";
import { deletePhotos } from "../src/server/storage";
async function cleanup() {
  const expires = new Date(Date.now() - 86400000);
  const removed = await db.$transaction(
    async (tx) => {
      const orphans = await tx.$queryRaw<
        { id: string; key: string }[]
      >`SELECT id, key FROM "IssueMedia" WHERE "issueId" IS NULL AND "createdAt" < ${expires} LIMIT 100 FOR UPDATE SKIP LOCKED`;
      if (orphans.length) {
        await deletePhotos(orphans.map((media) => media.key));
        await tx.issueMedia.deleteMany({
          where: {
            id: { in: orphans.map((media) => media.id) },
            issueId: null,
          },
        });
      }
      return orphans.length;
    },
    { timeout: 60000 },
  );
  const retention = Math.max(
    30,
    Number(process.env.AUDIT_RETENTION_DAYS ?? "365"),
  );
  if (Number.isFinite(retention))
    await db.auditLog.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - retention * 86400000) } },
    });
  await db.verificationToken.deleteMany({
    where: { expires: { lt: new Date() } },
  });
  await db.session.deleteMany({ where: { expires: { lt: new Date() } } });
  process.stdout.write(`Removed ${removed} unattached photos\n`);
}
cleanup()
  .catch(() => {
    process.stderr.write("Maintenance failed\n");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
