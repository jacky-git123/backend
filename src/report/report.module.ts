import { Module } from '@nestjs/common';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { SessionService } from 'src/session/session.service';
import { AgentReceivablesController } from './agent-receivables.controller';
import { AgentReceivablesService } from './agent-receivables.service';

@Module({
  controllers: [ReportController, AgentReceivablesController],
  providers: [ReportService, SessionService, AgentReceivablesService]
})
export class ReportModule {}
