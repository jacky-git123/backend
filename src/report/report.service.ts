import { Injectable } from '@nestjs/common';
import { GenerateAgentReportDto, GenerateReportDto, GetPaymentLoanDataDto, MonthlyPaymentSummary, PaymentWithLoan } from './dto/report.dto';
import { PrismaService } from 'nestjs-prisma';

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService,
  ) { }
  // This service will handle the logic for generating reports
  // You can inject other services here to fetch data and format it as needed

  async generateReport(generateReportDto: GenerateReportDto) {
    const { loan_data_from, loan_data_to, report_type } = generateReportDto;
    if (report_type === 'loan') {
      const loanData = await this.prisma.loan.findMany({
        where: {
          loan_date: {
            gte: new Date(loan_data_from).toISOString(),
            lte: new Date(loan_data_to).toISOString(),
          },
          deleted: false,
        },
        include: {
          customer: true,
          installment: true,
          payment: true,
          user: {
            select: {
              name: true
            }
          },
          user_2: {
            select: {
              name: true
            }
          }
        },
        orderBy: {
          loan_date: 'asc'
        }
      });

      const formattedData = loanData.map(loan => {
        const totalAmountReceived = loan.payment.reduce((sum, payment) => {
          if (payment.type === 'In') {
            return sum + parseFloat(payment.amount || '0');
          }
          return sum;
        }, 0).toFixed(2);

        const loanDate = new Date(loan.loan_date);
        const formattedDate = [
          loanDate.getDate().toString().padStart(2, '0'),
          (loanDate.getMonth() + 1).toString().padStart(2, '0'),
          loanDate.getFullYear()
        ].join('-');

        const nextDueInstallment = loan.installment
          .filter(inst => inst.installment_date) // remove entries without a date
          .sort((a, b) => new Date(a.installment_date).getTime() - new Date(b.installment_date).getTime())
          .find(inst => !inst.status || inst.status == null);

        return {
          loanData: loan,
          loanCreatedDate: loan.loan_date,
          loanId: loan.generate_id,
          agent: loan.user?.name || '',
          agent2: loan.user_2?.name || '',
          agentName2: loan.user_2?.name || '',
          customerName: loan.customer?.name || '',
          customerIc: loan.customer?.ic || '',
          loanAmount: parseFloat(loan.principal_amount).toFixed(2) || '0',
          payableAmount: parseFloat(loan.payment_per_term).toFixed(2) || '0',
          deposit: parseFloat(loan.deposit_amount).toFixed(2) || '0',
          out: (parseFloat(loan.principal_amount || '0') - parseFloat(loan.deposit_amount || '0')).toFixed(2),
          dueDate: nextDueInstallment?.installment_date || '',
          dueAmount: parseFloat(nextDueInstallment?.due_amount || '0').toFixed(2),
          totalAmountReceived: parseFloat(totalAmountReceived).toFixed(2),
          estimatedProfit: parseFloat(loan.estimated_profit).toFixed(2) || '0',
          actualProfit: parseFloat(loan.actual_profit).toFixed(2) || '0'
        };
      });

      return formattedData;
    }
    if (report_type === 'payment') {

      const paymentData = await this.prisma.payment.findMany({
        where: {
          payment_date: {
            gte: new Date(loan_data_from).toISOString(),
            lte: new Date(loan_data_to).toISOString(),
          }
        },
        orderBy: {
          payment_date: 'asc'
        }
      });

      const formatPaymentData = Promise.all(paymentData.map(async payment => {
        const loan = await this.prisma.loan.findUnique({
          where: { id: payment.loan_id, deleted: false },
          include: {
            customer: true,
            installment: true,
            payment: true,
            user: {
              select: {
                name: true
              }
            },
            user_2: {
              select: {
                name: true
              }
            }
          }
        });
        if (!loan) return null; // Skip if loan not found

        return {
          paymentType: payment.type,
          paymntin_out: payment.payment_date,
          agentName: loan.user?.name || '',
          agentName2: loan.user_2?.name || '',
          loanId: loan.generate_id,
          customerName: loan.customer?.name || '',
          totalPaymentIn: payment.type === 'In' ? payment.amount : '',
          totalPaymentOut: payment.type === 'Out' ? payment.amount : '',
          bankAgentAccountNo: payment.account_details || '',
          remarks: payment.remarks || '',
        };
      }));

      const filteredPaymentData = (await formatPaymentData).filter(item => item !== null);
      return filteredPaymentData;
      // return formatPaymentData;
    }
    return [];
  }

  /**
   * Get payment and loan data filtered by agent and date range
   * @param params - Object containing agent ID, from date, and to date
   * @returns Promise<PaymentWithLoan[]>
   */
  async getPaymentLoanData(params: GetPaymentLoanDataDto): Promise<PaymentWithLoan[]> {
    const { agent, fromDate, toDate } = params;

    try {
      const payments = await this.prisma.payment.findMany({
        where: {
          AND: [
            {
              payment_date: {
                gte: new Date(fromDate),
                lte: new Date(toDate),
              },
            },
            {
              loan: {
                OR: [
                  { supervisor: agent },
                  { supervisor_2: agent },
                ],
                AND: [
                  { deleted: false },
                ],
              },
            },
          ],
        },
        include: {
          loan: true,
        },
        orderBy: [
          { payment_date: 'desc' },
          { loan: { loan_date: 'desc' } },
        ],
      });

      return payments as PaymentWithLoan[];
    } catch (error) {
      console.error('Error fetching payment and loan data:', error);
      throw new Error('Failed to retrieve payment and loan data');
    }
  }

  /**
   * Get payment and loan data with monthly summary statistics
   * @param params - Object containing agent ID, from date, and to date
   * @returns Promise<PaymentLoanSummary>
   */
  async getPaymentLoanSummary(params: GetPaymentLoanDataDto): Promise<any> {
    const data = await this.getPaymentLoanData(params);

    const { agent, fromDate, toDate } = params;

    // Get the years covered by the date range to fetch expenses
    const startYear = new Date(fromDate).getFullYear();
    const endYear = new Date(toDate).getFullYear();
    const years = [];
    for (let year = startYear; year <= endYear; year++) {
      years.push(year.toString());
    }

    // Fetch expenses for all relevant years
    const expensePromises = years.map(year => this.getAgentExpenses(agent, year));
    const expensesByYear = await Promise.all(expensePromises);

    // Create a map of year -> expenses for quick lookup
    const expensesMap = new Map<string, any>();
    expensesByYear.forEach((expenses, index) => {
      if (expenses) {
        expensesMap.set(years[index], expenses);
      }
    });

    // const totalPayments = data.length;
    // const totalAmount = data.reduce((sum, payment) => {
    //   const amount = parseFloat(payment.amount || '0');
    //   return sum + (isNaN(amount) ? 0 : amount);
    // }, 0);

    // const uniqueLoans = new Set(data.map(payment => payment.loan.id));
    // const totalLoans = uniqueLoans.size;

    // Group payments by month and calculate In/Out/Balance
    const monthlyData = new Map<string, {
      paymentIn: number;
      paymentOut: number;
      count: number;
      expense: number;
    }>();

    data.forEach(payment => {
      if (payment.payment_date) {
        const monthKey = payment.payment_date.toISOString().substring(0, 7); // YYYY-MM
        const amount = parseFloat(payment.amount || '0');

        if (!monthlyData.has(monthKey)) {

          // Extract year and month from monthKey (YYYY-MM)
          const [yearStr, monthStr] = monthKey.split('-');
          const monthNum = parseInt(monthStr, 10);
          const yearExpenses = expensesMap.get(yearStr);
          const monthlyExpense = this.getMonthlyExpense(yearExpenses, monthNum);
          // Initialize monthly data with expense
          monthlyData.set(monthKey, {
            paymentIn: 0,
            paymentOut: 0,
            count: 0,
            expense: monthlyExpense,
          });
        }

        const monthData = monthlyData.get(monthKey)!;
        monthData.count++;

        // Determine if payment is In or Out based on payment type
        // You may need to adjust this logic based on your business rules
        if (payment.type === 'In' || payment.type === 'payment_in' || payment.type === 'credit') {
          monthData.paymentIn += isNaN(amount) ? 0 : amount;
        } else if (payment.type === 'Out' || payment.type === 'payment_out' || payment.type === 'debit') {
          monthData.paymentOut += isNaN(amount) ? 0 : amount;
        } else {
          // If type is not specified or unknown, treat positive amounts as In, negative as Out
          if (amount >= 0) {
            monthData.paymentIn += amount;
          } else {
            monthData.paymentOut += Math.abs(amount);
          }
        }
      }
    });

    // Handle months within the date range that might not have payments but should show expenses
    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);
    const currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

    while (currentDate <= endDate) {
      const monthKey = currentDate.toISOString().substring(0, 7); // YYYY-MM
      
      if (!monthlyData.has(monthKey)) {
        const yearStr = currentDate.getFullYear().toString();
        const monthNum = currentDate.getMonth() + 1;
        const yearExpenses = expensesMap.get(yearStr);
        const monthlyExpense = this.getMonthlyExpense(yearExpenses, monthNum);

        monthlyData.set(monthKey, {
          paymentIn: 0,
          paymentOut: 0,
          count: 0,
          expense: monthlyExpense,
        });
      }

      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    // Convert to array and sort by month
    const monthlyBreakdown: MonthlyPaymentSummary[] = Array.from(monthlyData.entries())
      .map(([month, data]) => ({
        month,
        totalPaymentIn: data.paymentIn,
        totalPaymentOut: data.paymentOut,
        balance: data.paymentIn - data.paymentOut,
        // paymentCount: data.count,
        expense: data.expense, // Add expense to the breakdown
        // netBalance: data.paymentIn - data.paymentOut - data.expense, // Optional: net balance after expenses
        finalBalance: ((data.paymentIn - data.paymentOut) - data.expense), // Final balance after expenses
      }))
      .sort((a, b) => a.month.localeCompare(b.month));


    return {
      monthlyBreakdown
      // totalPayments,
      // totalAmount,
      // totalLoans,
      // data,
    };
  }

  /**
   * Get expenses for a specific agent and year
   * @param agentId - UUID of the agent
   * @param year - Year in YYYY format
   * @returns Promise with expenses data
   */
  async getAgentExpenses(agentId: string, year: string) {
    try {
      const expenses = await this.prisma.expenses.findFirst({
        where: {
          user_id: agentId,
          year: year,
          OR: [
            { deleted: null },
            { deleted: false },
          ],
        },
      });

      return expenses;
    } catch (error) {
      console.error('Error fetching agent expenses:', error);
      return null;
    }
  }

  /**
   * Get monthly expense amount for a specific month
   * @param expenses - Expenses record
   * @param month - Month number (1-12)
   * @returns Expense amount for the month
   */
  private getMonthlyExpense(expenses: any, month: number): number {
    if (!expenses) return 0;

    const monthFields = {
      1: 'jan', 2: 'feb', 3: 'mar', 4: 'apr',
      5: 'may', 6: 'jun', 7: 'jul', 8: 'aug',
      9: 'sep', 10: 'oct', 11: 'nov', 12: 'dec'
    };

    const fieldName = monthFields[month as keyof typeof monthFields];
    const expenseValue = expenses[fieldName];
    
    return expenseValue ? parseFloat(expenseValue) || 0 : 0;
  }
}
