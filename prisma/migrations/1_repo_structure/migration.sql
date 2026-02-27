CREATE TABLE "RepoStructure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "repoId" TEXT NOT NULL,
    CONSTRAINT "RepoStructure_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RepoStructure_repoId_type_source_key" ON "RepoStructure"("repoId", "type", "source");
CREATE INDEX "RepoStructure_repoId_idx" ON "RepoStructure"("repoId");
