import { Module } from '@nestjs/common';
import { LoanController } from './loan.controller';
import { LoanService } from './loan.service';
import { RunningNumberGenerator } from 'src/common/utils';
import { SessionAuthGuard } from 'src/session/session-auth.guard';
import { SessionSerializer } from 'src/session/session-serializer.service';
import { SessionService } from 'src/session/session.service';

@Module({
  controllers: [LoanController],
  providers: [LoanService,RunningNumberGenerator, SessionAuthGuard, SessionSerializer, SessionService]
})
export class LoanModule {}
