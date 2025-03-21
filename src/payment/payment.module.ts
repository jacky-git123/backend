import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { RunningNumberGenerator } from 'src/common/utils';

@Module({
  controllers: [PaymentController],
  providers: [PaymentService,RunningNumberGenerator]
})
export class PaymentModule {}
