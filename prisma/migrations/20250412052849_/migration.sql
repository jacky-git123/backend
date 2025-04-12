-- AlterTable
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = 'customer'::regclass AND attname = 'created_at') THEN
        ALTER TABLE "customer" ADD COLUMN "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = 'customer'::regclass AND attname = 'updated_at') THEN
        ALTER TABLE "customer" ADD COLUMN "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- AlterTable
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = 'document'::regclass AND attname = 'created_at') THEN
        ALTER TABLE "document" ADD COLUMN "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = 'document'::regclass AND attname = 'updated_at') THEN
        ALTER TABLE "document" ADD COLUMN "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- AlterTable
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = 'installment'::regclass AND attname = 'created_at') THEN
        ALTER TABLE "installment" ADD COLUMN "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = 'installment'::regclass AND attname = 'updated_at') THEN
        ALTER TABLE "installment" ADD COLUMN "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- AlterTable
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = 'loan'::regclass AND attname = 'created_at') THEN
        ALTER TABLE "loan" ADD COLUMN "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = 'loan'::regclass AND attname = 'updated_at') THEN
        ALTER TABLE "loan" ADD COLUMN "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- AlterTable
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = 'loan_share'::regclass AND attname = 'created_at') THEN
        ALTER TABLE "loan_share" ADD COLUMN "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = 'loan_share'::regclass AND attname = 'updated_at') THEN
        ALTER TABLE "loan_share" ADD COLUMN "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- AlterTable
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = 'payment'::regclass AND attname = 'created_at') THEN
        ALTER TABLE "payment" ADD COLUMN "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = 'payment'::regclass AND attname = 'updated_at') THEN
        ALTER TABLE "payment" ADD COLUMN "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- AlterTable
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = 'user'::regclass AND attname = 'updated_at') THEN
        ALTER TABLE "user" ADD COLUMN "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;
