-- AlterTable
ALTER TABLE "customer" ADD COLUMN     "updated_by" UUID;

-- AlterTable
ALTER TABLE "installment" ADD COLUMN     "created_by" UUID,
ADD COLUMN     "updated_by" UUID;

-- AlterTable
ALTER TABLE "loan" ADD COLUMN     "updated_by" UUID;

-- AlterTable
ALTER TABLE "payment" ADD COLUMN     "created_by" UUID,
ADD COLUMN     "updated_by" UUID;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "deleted" BOOLEAN DEFAULT false;
