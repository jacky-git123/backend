-- AlterTable
ALTER TABLE "payment" ADD COLUMN     "loan_id" UUID;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_loan_fk" FOREIGN KEY ("loan_id") REFERENCES "loan"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
