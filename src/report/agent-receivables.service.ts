import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import {
  AgentReceivableRow,
  AgentReceivablesResponse,
  GetAgentReceivablesDto,
} from './dto/agent-receivables.dto';

// Roles that can see every agent's receivables
const ALL_ACCESS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'VIEWER'];

@Injectable()
export class AgentReceivablesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Agent ids the logged-in user may see.
   * Returns null when the user can see all agents.
   * - SUPER_ADMIN / ADMIN / VIEWER: all agents
   * - LEAD: themself + agents they supervise
   * - AGENT: only themself
   */
  private async getVisibleAgentIds(authUserId: string): Promise<string[] | null> {
    const authUser = await this.prisma.user.findFirst({
      where: { id: authUserId },
      select: { id: true, role: true },
    });

    if (!authUser) {
      throw new ForbiddenException('User not found');
    }

    if (ALL_ACCESS_ROLES.includes(authUser.role as string)) {
      return null;
    }

    if (authUser.role === 'LEAD') {
      const agents = await this.prisma.user.findMany({
        where: { supervisor: authUser.id, deleted: { not: true } },
        select: { id: true },
      });
      return [authUser.id, ...agents.map((a) => a.id)];
    }

    return [authUser.id];
  }

  private async assertCanViewAgent(authUserId: string, agentId: string) {
    const visible = await this.getVisibleAgentIds(authUserId);
    if (visible && !visible.includes(agentId)) {
      throw new ForbiddenException('You are not allowed to view this agent');
    }
  }

  /** Agents shown in the agent dropdown, limited by the user's role. */
  async getAgents(authUserId: string) {
    const visible = await this.getVisibleAgentIds(authUserId);

    return this.prisma.user.findMany({
      where: {
        deleted: { not: true },
        ...(visible
          ? { id: { in: visible } }
          : { role: { in: ['AGENT', 'LEAD'] as any } }),
      },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });
  }

  /** Customers who have at least one loan with this agent (for the customer dropdown). */
  async getCustomersForAgent(authUserId: string, agentId: string) {
    if (!agentId) {
      throw new BadRequestException('agentId is required');
    }
    await this.assertCanViewAgent(authUserId, agentId);

    const loans = await this.prisma.loan.findMany({
      where: {
        deleted: { not: true },
        OR: [{ supervisor: agentId }, { supervisor_2: agentId }],
        customer_id: { not: null },
      },
      select: {
        customer: { select: { id: true, name: true, ic: true } },
      },
    });

    // Unique customers, sorted by name
    const byId = new Map<string, { id: string; name: string; ic: string }>();
    for (const loan of loans) {
      if (loan.customer && !byId.has(loan.customer.id)) {
        byId.set(loan.customer.id, {
          id: loan.customer.id,
          name: loan.customer.name || '',
          ic: loan.customer.ic || '',
        });
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async getAgentReceivables(
    authUserId: string,
    dto: GetAgentReceivablesDto,
  ): Promise<AgentReceivablesResponse> {
    const { agentId } = dto;
    if (!agentId) {
      throw new BadRequestException('agentId is required');
    }
    await this.assertCanViewAgent(authUserId, agentId);

    const agent = await this.prisma.user.findFirst({
      where: { id: agentId, deleted: { not: true } },
      select: { id: true, name: true },
    });
    if (!agent) {
      throw new BadRequestException('Agent not found');
    }

    const fromDate = this.parseDate(dto.fromDate, 'fromDate');
    const toDate = this.parseDate(dto.toDate, 'toDate');
    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException('fromDate cannot be after toDate');
    }

    const loanIdFrom = this.loanIdNumber(dto.loanIdFrom, 'loanIdFrom');
    const loanIdTo = this.loanIdNumber(dto.loanIdTo, 'loanIdTo');
    if (loanIdFrom !== null && loanIdTo !== null && loanIdFrom > loanIdTo) {
      throw new BadRequestException('Loan ID From cannot be after Loan ID To');
    }

    // Loan created date range: from / to are inclusive
    const loanDateCondition: any = {};
    if (fromDate) loanDateCondition.gte = fromDate;
    if (toDate) {
      const dayAfterTo = new Date(toDate);
      dayAfterTo.setUTCDate(dayAfterTo.getUTCDate() + 1);
      loanDateCondition.lt = dayAfterTo;
    }

    const customerIds = (dto.customerIds || []).filter(Boolean);

    const loans = await this.prisma.loan.findMany({
      where: {
        deleted: { not: true },
        OR: [{ supervisor: agentId }, { supervisor_2: agentId }],
        ...(customerIds.length ? { customer_id: { in: customerIds } } : {}),
        ...(fromDate || toDate ? { loan_date: loanDateCondition } : {}),
      },
      include: {
        customer: { select: { id: true, name: true, ic: true } },
        installment: { where: { deleted: false } },
        user: { select: { id: true, name: true } },
        user_2: { select: { id: true, name: true } },
      },
      orderBy: { loan_date: 'desc' },
    });

    const rows: AgentReceivableRow[] = [];

    for (const loan of loans as any[]) {
      // Loan ID range is checked on the number part, e.g. LN2600012 -> 2600012
      if (loanIdFrom !== null || loanIdTo !== null) {
        const loanNumber = this.loanIdNumber(loan.generate_id, 'generate_id', false);
        if (loanNumber === null) continue;
        if (loanIdFrom !== null && loanNumber < loanIdFrom) continue;
        if (loanIdTo !== null && loanNumber > loanIdTo) continue;
      }

      // Shared loan: two different agents, each gets half
      const isShared =
        !!loan.supervisor && !!loan.supervisor_2 && loan.supervisor !== loan.supervisor_2;
      const share = isShared ? 0.5 : 1;
      const sharedWith = isShared
        ? loan.supervisor === agentId
          ? loan.user_2?.name || null
          : loan.user?.name || null
        : null;

      // Payable amount = principal - deposit (same as the Payment screen)
      const payableAmount =
        (parseFloat(loan.principal_amount) || 0) - (parseFloat(loan.deposit_amount) || 0);

      // Received = due amount of every installment marked Paid
      const paidTotal = (loan.installment || [])
        .filter((inst: any) => (inst.status || '').toString().trim().toLowerCase() === 'paid')
        .reduce((sum: number, inst: any) => sum + (parseFloat(inst.due_amount) || 0), 0);

      // Yet to receive = payable - received (never below 0)
      // e.g. payable 5000, 5 x 1000 installments, 2 paid -> 5000 - 2000 = 3000
      const yetToReceive = Math.max(payableAmount - paidTotal, 0);

      rows.push({
        loanId: loan.id,
        loanGenerateId: loan.generate_id,
        agentName: agent.name || '',
        sharedWith,
        isShared,
        sharePercent: share * 100,
        loanDate: loan.loan_date,
        customerId: loan.customer?.id || null,
        customerName: loan.customer?.name || '',
        customerIC: loan.customer?.ic || '',
        amountGiven: this.round2((parseFloat(loan.amount_given) || 0) * share),
        payableAmount: this.round2(payableAmount * share),
        amountReceived: this.round2(paidTotal * share),
        amountToReceive: this.round2(yetToReceive * share),
      });
    }

    return {
      agent: { id: agent.id, name: agent.name || '' },
      rows,
      totals: {
        loanCount: rows.length,
        amountGiven: this.round2(rows.reduce((s, r) => s + r.amountGiven, 0)),
        payableAmount: this.round2(rows.reduce((s, r) => s + r.payableAmount, 0)),
        amountReceived: this.round2(rows.reduce((s, r) => s + r.amountReceived, 0)),
        amountToReceive: this.round2(rows.reduce((s, r) => s + r.amountToReceive, 0)),
      },
    };
  }

  // yyyy-MM-dd -> Date at UTC midnight, so it matches the DATE column exactly
  private parseDate(value: string | undefined, name: string): Date | undefined {
    const text = (value ?? '').toString().trim();
    if (!text) return undefined;

    const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!match) {
      throw new BadRequestException(`${name} must be in yyyy-MM-dd format`);
    }
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException(`${name} is not a valid date`);
    }
    return date;
  }

  // "LN2600012" -> 2600012. Returns null when empty.
  private loanIdNumber(value: string | undefined, name: string, strict = true): number | null {
    const text = (value ?? '').toString().trim();
    if (!text) return null;
    const digits = text.replace(/\D/g, '');
    if (!digits) {
      if (strict) throw new BadRequestException(`${name} must contain a number, e.g. LN2600012`);
      return null;
    }
    return Number(digits);
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
