import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { RunningNumberGenerator } from 'src/common/utils';
import { LoanService } from 'src/loan/loan.service';
import { LoanModule } from 'src/loan/loan.module';
import { Session } from 'inspector/promises';
import { SessionService } from 'src/session/session.service';

@Module({
  controllers: [PaymentController],
  providers: [PaymentService,RunningNumberGenerator,LoanService, SessionService],
  imports: [LoanModule],
})
export class PaymentModule {}
