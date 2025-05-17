import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { RunningNumberGenerator } from 'src/common/utils';
import { LoanService } from 'src/loan/loan.service';
import { LoanModule } from 'src/loan/loan.module';

@Module({
  controllers: [PaymentController],
  providers: [PaymentService,RunningNumberGenerator,LoanService],
  imports: [LoanModule],
})
export class PaymentModule {}
