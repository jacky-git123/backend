import { Module } from '@nestjs/common';
import { LoanController } from './loan.controller';
import { LoanService } from './loan.service';
import { RunningNumberGenerator } from 'src/common/utils';

@Module({
  controllers: [LoanController],
  providers: [LoanService,RunningNumberGenerator]
})
export class LoanModule {}
