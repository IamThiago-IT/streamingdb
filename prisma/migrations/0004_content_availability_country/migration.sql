-- Disponibilidade de catálogo passa a ser por país (alinha com o cookie
-- sdb_country e com watch/providers da TMDB). Linhas existentes ficam no BR.

ALTER TABLE "ContentAvailability"
  ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT 'BR';

DROP INDEX "ContentAvailability_contentId_platformId_key";

CREATE UNIQUE INDEX "ContentAvailability_contentId_platformId_countryCode_key"
  ON "ContentAvailability"("contentId", "platformId", "countryCode");

DROP INDEX "ContentAvailability_platformId_available_lastVerifiedAt_idx";

CREATE INDEX "ContentAvailability_platformId_countryCode_available_lastVerifiedAt_idx"
  ON "ContentAvailability"("platformId", "countryCode", "available", "lastVerifiedAt");
