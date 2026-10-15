ALTER TABLE "Issue" ADD COLUMN "affectedCount" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "notAffectedCount" INTEGER NOT NULL DEFAULT 0;
UPDATE "Issue" i SET "affectedCount" = (SELECT count(*) FROM "Reaction" r WHERE r."issueId" = i.id AND r.type = 'AFFECTED'), "notAffectedCount" = (SELECT count(*) FROM "Reaction" r WHERE r."issueId" = i.id AND r.type = 'NOT_AFFECTED');
CREATE INDEX "Issue_affectedCount_createdAt_id_idx" ON "Issue"("affectedCount" DESC, "createdAt" DESC, id DESC);
ALTER TABLE "IssueMedia" ALTER COLUMN "issueId" DROP NOT NULL, ADD COLUMN "ownerId" TEXT, ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "IssueMedia" m SET "ownerId" = i."authorId" FROM "Issue" i WHERE m."issueId" = i.id;
ALTER TABLE "IssueMedia" ALTER COLUMN "ownerId" SET NOT NULL;
CREATE INDEX "IssueMedia_ownerId_createdAt_idx" ON "IssueMedia"("ownerId", "createdAt");
ALTER TABLE "Review" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Report" ALTER COLUMN "issueId" DROP NOT NULL, ADD COLUMN "reviewId" TEXT;
ALTER TABLE "Report" ADD CONSTRAINT "Report_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_exactly_one_target" CHECK (("issueId" IS NOT NULL)::int + ("reviewId" IS NOT NULL)::int = 1);
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_check" CHECK (rating BETWEEN 1 AND 5);
CREATE INDEX "Report_handled_createdAt_idx" ON "Report"(handled, "createdAt");
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_actorId_fkey";
ALTER TABLE "AuditLog" ALTER COLUMN "actorId" DROP NOT NULL;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IssueMedia" ADD CONSTRAINT "IssueMedia_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE;
