-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'LEAD', 'AGENT');

-- CreateTable
CREATE TABLE "city" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "state_id" UUID NOT NULL,

    CONSTRAINT "city_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "country" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "country_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255),
    "gender" VARCHAR(255),
    "ic" VARCHAR(255),
    "name" VARCHAR(255),
    "passport" VARCHAR(255),
    "race" VARCHAR(255),
    "deleted_at" TIMESTAMP(3),
    "bank_details" JSONB,
    "created_by" UUID,
    "customer_address" JSONB,
    "employment" JSONB,
    "relations" JSONB,
    "supervisor" UUID,
    "car_plate" VARCHAR(255),
    "marital_status" VARCHAR(255),
    "mobile_no" VARCHAR(255),
    "no_of_child" INTEGER,
    "tel_code" VARCHAR(255),
    "tel_no" VARCHAR(255),
    "status" VARCHAR(255),
    "remarks" JSONB,

    CONSTRAINT "customer_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "path" VARCHAR(255) NOT NULL,
    "size" VARCHAR(255) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "customer_id" UUID,

    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installment" (
    "id" UUID NOT NULL,
    "key" VARCHAR,
    "installment_date" VARCHAR,
    "due_amount" VARCHAR,
    "receiving_date" VARCHAR,
    "status" VARCHAR,
    "loan_id" UUID,

    CONSTRAINT "installment_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan" (
    "id" UUID NOT NULL,
    "customer_id" UUID,
    "repayment_date" VARCHAR,
    "principal_amount" VARCHAR,
    "deposit_amount" VARCHAR,
    "application_fee" VARCHAR,
    "interest" VARCHAR,
    "remark" VARCHAR,
    "created_by" UUID,
    "supervisor" UUID,
    "date_period" VARCHAR,
    "loan_remark" VARCHAR,
    "payment_up_front" VARCHAR,
    "unit_of_date" VARCHAR,

    CONSTRAINT "loan_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_share" (
    "id" UUID NOT NULL,
    "loan_id" UUID,

    CONSTRAINT "loan_share_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" UUID NOT NULL,
    "type" VARCHAR,
    "installment_id" UUID,
    "payment_date" VARCHAR,
    "amount" VARCHAR,
    "balance" VARCHAR,
    "account_details" VARCHAR,

    CONSTRAINT "payment_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "state" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "country_id" UUID NOT NULL,

    CONSTRAINT "state_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" "Role" DEFAULT 'AGENT',
    "supervisor" UUID,
    "name" VARCHAR(255),
    "status" BOOLEAN DEFAULT true,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- AddForeignKey
ALTER TABLE "city" ADD CONSTRAINT "city_state_fk" FOREIGN KEY ("state_id") REFERENCES "state"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_customer-id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "installment" ADD CONSTRAINT "installment_loan_fk" FOREIGN KEY ("loan_id") REFERENCES "loan"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "loan" ADD CONSTRAINT "loan_customer_fk" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "loan_share" ADD CONSTRAINT "loan_share_loan_fk" FOREIGN KEY ("loan_id") REFERENCES "loan"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_installment_fk" FOREIGN KEY ("installment_id") REFERENCES "installment"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "state" ADD CONSTRAINT "state_country_fk" FOREIGN KEY ("country_id") REFERENCES "country"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
