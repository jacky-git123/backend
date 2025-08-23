export class GenerateReportDto {
    loan_date_from?: string;
    loan_date_to?: string;
    report_type?: string;

    payment_date_from?: string; 
    payment_date_to?: string;
}

export class GenerateAgentReportDto {
    from?: string;
    to?: string;
    agent_id?: string;

    // payment_date_from?: string; 
    // payment_date_to?: string;
}

export class GetPaymentLoanDataDto {
  agent: string[]; // UUID of supervisor or supervisor_2
  fromDate: string; // YYYY-MM-DD format
  toDate: string; // YYYY-MM-DD format
}

export interface PaymentWithLoan {
  id: string;
  type: string | null;
  installment_id: string | null;
  amount: string | null;
  balance: string | null;
  account_details: string | null;
  loan_id: string | null;
  generate_id: string | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
  remarks: string | null;
  payment_date: Date | null;
  installment_date: Date | null;
  loan: {
    id: string;
    customer_id: string | null;
    principal_amount: string | null;
    deposit_amount: string | null;
    application_fee: string | null;
    interest: string | null;
    remark: string | null;
    created_by: string | null;
    supervisor: string | null;
    date_period: string | null;
    loan_remark: string | null;
    unit_of_date: string | null;
    generate_id: string;
    repayment_term: string | null;
    status: string | null;
    amount_given: string | null;
    interest_amount: string | null;
    payment_per_term: string | null;
    supervisor_2: string | null;
    created_at: Date;
    deleted: boolean | null;
    updated_at: Date;
    actual_profit: string | null;
    estimated_profit: string | null;
    updated_by: string | null;
    repayment_date: Date | null;
    loan_date: Date | null;
  };
}

export interface MonthlyPaymentSummary {
  month: string; // YYYY-MM format
  totalPaymentIn: number;
  totalPaymentOut: number;
  balance: number; // In - Out
  paymentCount?: number;
}
