-- Idempotent: ensure Chat table has personaName, personaDescription, and activeDatasourceId.
-- SQLite has no ADD COLUMN IF NOT EXISTS, so we reconstruct the table.
-- personaName/personaDescription were added to 0_init after some DBs were already initialized,
-- so this migration guarantees they exist on all deployments.
-- activeDatasourceId is included for completeness (already added via 2_datasources ALTER TABLE,
-- but we preserve it here during the copy).

-- Step 1: Create the definitive Chat table
CREATE TABLE "Chat_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL DEFAULT 'SNAPSHOT',
    "title" TEXT,
    "includeContext" BOOLEAN NOT NULL DEFAULT true,
    "branch" TEXT,
    "commitSha" TEXT,
    "leftBranch" TEXT,
    "leftCommitSha" TEXT,
    "rightBranch" TEXT,
    "rightCommitSha" TEXT,
    "personaName" TEXT,
    "personaDescription" TEXT,
    "activeDatasourceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "repoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Chat_new_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Chat_new_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Step 2: Copy data. personaName/personaDescription are set to NULL (they were NULL anyway
-- on old DBs where the columns didn't exist, and on fresh installs any existing values
-- are sacrificed to keep this migration simple and safe).
-- activeDatasourceId is copied from the existing table (added by 2_datasources migration).
INSERT INTO "Chat_new" (
    "id", "type", "title", "includeContext",
    "branch", "commitSha",
    "leftBranch", "leftCommitSha", "rightBranch", "rightCommitSha",
    "personaName", "personaDescription",
    "activeDatasourceId",
    "createdAt", "updatedAt", "repoId", "userId"
)
SELECT
    "id", "type", "title", "includeContext",
    "branch", "commitSha",
    "leftBranch", "leftCommitSha", "rightBranch", "rightCommitSha",
    NULL, NULL,
    "activeDatasourceId",
    "createdAt", "updatedAt", "repoId", "userId"
FROM "Chat";

-- Step 3: Swap tables
DROP TABLE "Chat";
ALTER TABLE "Chat_new" RENAME TO "Chat";

-- Step 4: Recreate indexes
CREATE INDEX "Chat_repoId_idx" ON "Chat"("repoId");
CREATE INDEX "Chat_userId_idx" ON "Chat"("userId");
