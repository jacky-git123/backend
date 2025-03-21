-- AlterTable
ALTER TABLE "installment" ADD COLUMN     "accepted_amount" VARCHAR;

-- AlterTable
ALTER TABLE "loan" ADD COLUMN     "amount_given" VARCHAR,
ADD COLUMN     "interest_amount" VARCHAR,
ADD COLUMN     "payment_per_term" VARCHAR;

-- AddForeignKey
ALTER TABLE "loan" ADD CONSTRAINT "loan_user_fk" FOREIGN KEY ("supervisor") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
