-- AlterTable
ALTER TABLE "user" ADD COLUMN     "last_login" TIMESTAMP(6),
ADD COLUMN     "session_count" INTEGER DEFAULT 0;

-- CreateTable
CREATE TABLE "sessions" (
    "id" VARCHAR(128) NOT NULL,
    "sid" VARCHAR(128) NOT NULL,
    "data" JSONB NOT NULL,
    "expires" TIMESTAMP(6) NOT NULL,
    "userId" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sid_key" ON "sessions"("sid");

-- CreateIndex
CREATE INDEX "sessions_expires_idx" ON "sessions"("expires");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
