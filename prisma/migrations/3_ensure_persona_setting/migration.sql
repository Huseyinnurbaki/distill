-- Idempotent: create Persona and Setting tables if they were missing from an
-- older version of 0_init (i.e. the DB was initialized before these models existed).

CREATE TABLE IF NOT EXISTS "Persona" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "technicalDepth" INTEGER NOT NULL DEFAULT 3,
    "codeExamples" INTEGER NOT NULL DEFAULT 3,
    "assumedKnowledge" INTEGER NOT NULL DEFAULT 3,
    "businessContext" INTEGER NOT NULL DEFAULT 3,
    "responseDetail" INTEGER NOT NULL DEFAULT 3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "Persona_name_key" ON "Persona"("name");

CREATE TABLE IF NOT EXISTS "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
