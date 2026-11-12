export class GetAgentReceivablesDto {
  agentId: string; // single agent (supervisor or supervisor_2 on the loan)
  customerIds?: string[]; // optional, multiple customers
  fromDate?: string; // loan created date, yyyy-MM-dd
  toDate?: string; // loan created date, yyyy-MM-dd
  loanIdFrom?: string; // e.g. LN2600001
  loanIdTo?: string; // e.g. LN2600050
}

export interface AgentReceivableRow {
  loanId: string;
  loanGenerateId: string;
  agentName: string;
  sharedWith: string | null; // the other agent's name when the loan is shared
  isShared: boolean;
  sharePercent: number; // 100 or 50
  loanDate: Date | null;
  customerId: string | null;
  customerName: string;
  customerIC: string;
  amountGiven: number; // agent's share
  payableAmount: number; // principal - deposit, agent's share
  amountReceived: number; // paid installments, agent's share
  amountToReceive: number; // payable - received, agent's share
}

export interface AgentReceivablesResponse {
  agent: { id: string; name: string };
  rows: AgentReceivableRow[];
  totals: {
    loanCount: number;
    amountGiven: number;
    payableAmount: number;
    amountReceived: number;
    amountToReceive: number;
  };
}
