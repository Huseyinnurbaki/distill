-- CreateTable
CREATE TABLE "Datasource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'postgres',
    "encryptedConnString" TEXT NOT NULL,
    "cachedSchema" TEXT,
    "schemaUpdatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DatasourceAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch" TEXT NOT NULL,
    "datasourceId" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    CONSTRAINT "DatasourceAssignment_datasourceId_fkey" FOREIGN KEY ("datasourceId") REFERENCES "Datasource" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DatasourceAssignment_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DatasourceAccess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datasourceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "DatasourceAccess_datasourceId_fkey" FOREIGN KEY ("datasourceId") REFERENCES "Datasource" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DatasourceAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DatasourceDictionaryEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "term" TEXT NOT NULL,
    "aliases" TEXT,
    "value" TEXT NOT NULL,
    "notes" TEXT,
    "datasourceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DatasourceDictionaryEntry_datasourceId_fkey" FOREIGN KEY ("datasourceId") REFERENCES "Datasource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "Chat" ADD COLUMN "activeDatasourceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DatasourceAssignment_datasourceId_repoId_branch_key" ON "DatasourceAssignment"("datasourceId", "repoId", "branch");

-- CreateIndex
CREATE INDEX "DatasourceAssignment_datasourceId_idx" ON "DatasourceAssignment"("datasourceId");

-- CreateIndex
CREATE INDEX "DatasourceAssignment_repoId_idx" ON "DatasourceAssignment"("repoId");

-- CreateIndex
CREATE UNIQUE INDEX "DatasourceAccess_datasourceId_userId_key" ON "DatasourceAccess"("datasourceId", "userId");

-- CreateIndex
CREATE INDEX "DatasourceAccess_datasourceId_idx" ON "DatasourceAccess"("datasourceId");

-- CreateIndex
CREATE INDEX "DatasourceDictionaryEntry_datasourceId_idx" ON "DatasourceDictionaryEntry"("datasourceId");
