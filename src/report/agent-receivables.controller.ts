import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from 'src/session/session-auth.guard';
import { CurrentUser } from 'src/session/current-user.decorator';
import { SessionUser } from 'src/session/session.dto';
import { AgentReceivablesService } from './agent-receivables.service';
import { GetAgentReceivablesDto } from './dto/agent-receivables.dto';

// Agent Receivables Report.
// What each user can see is decided on the server from their role.
@Controller('report/agent-receivables')
@UseGuards(SessionAuthGuard)
export class AgentReceivablesController {
  constructor(private readonly agentReceivablesService: AgentReceivablesService) {}

  // GET /report/agent-receivables/agents
  @Get('agents')
  getAgents(@CurrentUser() user: SessionUser) {
    return this.agentReceivablesService.getAgents(user.id);
  }

  // GET /report/agent-receivables/customers?agentId=...
  @Get('customers')
  getCustomers(@CurrentUser() user: SessionUser, @Query('agentId') agentId: string) {
    return this.agentReceivablesService.getCustomersForAgent(user.id, agentId);
  }

  // POST /report/agent-receivables
  // body: { agentId, customerIds?, fromDate?, toDate?, loanIdFrom?, loanIdTo? }
  @Post()
  getReport(@CurrentUser() user: SessionUser, @Body() dto: GetAgentReceivablesDto) {
    return this.agentReceivablesService.getAgentReceivables(user.id, dto);
  }
}
