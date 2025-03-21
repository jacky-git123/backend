-- AlterTable
ALTER TABLE "loan" ADD COLUMN     "supervisor_2" UUID;

-- AddForeignKey
ALTER TABLE "loan" ADD CONSTRAINT "loan_user_fk_2" FOREIGN KEY ("supervisor_2") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
