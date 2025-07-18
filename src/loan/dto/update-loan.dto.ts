import { PartialType } from '@nestjs/mapped-types';
import { CreateLoanDto } from './create-loan.dto';

export class UpdateLoanDto extends PartialType(CreateLoanDto) {
  installment: any;
  loan_share: any;
  userid?: any;
  repayment_date?: any;
  loan_date:any
}
