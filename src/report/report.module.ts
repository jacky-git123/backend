import { Module } from '@nestjs/common';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { SessionService } from 'src/session/session.service';

@Module({
  controllers: [ReportController],
  providers: [ReportService, SessionService]
})
export class ReportModule {}
