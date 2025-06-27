-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "year" VARCHAR(255),
    "jan" VARCHAR(255),
    "feb" VARCHAR(255),
    "mar" VARCHAR(255),
    "apr" VARCHAR(255),
    "may" VARCHAR(255),
    "jun" VARCHAR(255),
    "jul" VARCHAR(255),
    "aug" VARCHAR(255),
    "sep" VARCHAR(255),
    "oct" VARCHAR(255),
    "nov" VARCHAR(255),
    "dec" VARCHAR(255),
    "deleted" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);
