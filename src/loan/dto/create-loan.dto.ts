export class CreateLoanDto {
    customer_id?: any;
    loan_package?: string;
    repayment_date?: string;
    principal_amount?: string;
    deposit_amount?: string;
    application_fee?: string;
    interest?: string;
    amount_given?:string;
    interest_amount?:string;
    payment_per_term?:string;
    remark: string;
    created_by: string;
    supervisor: string;
    supervisor_2?:string;
}
