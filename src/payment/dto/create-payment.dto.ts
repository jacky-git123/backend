export class CreatePaymentDto {
  type: string;
  installment_id: string;
  payment_date: string;
  amount: string;
  balance: string;
  account_details: string;
  remarks?: string;
  generate_id?: string;

}