import { Injectable } from '@nestjs/common';
import { GenerateReportDto, GetSalesReportDto, GetUserExpensesDto, MonthlyBreakdown, SalesReportResponse, UserExpensesResponse } from './dto/report.dto';
import { PrismaService } from 'nestjs-prisma';

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService,
  ) { }
  // This service will handle the logic for generating reports
  // You can inject other services here to fetch data and format it as needed

  async generateReport(generateReportDto: GenerateReportDto) {
    const {
      loan_date_from,
      loan_date_to,
      report_type,
      payment_date_from,
      payment_date_to
    } = generateReportDto;

    if (report_type === 'loan') {
      // For loan reports, we can filter by loan dates and optionally by payment dates
      let whereClause: any = {
        deleted: false,
      };

      // Always filter by loan dates if provided
      if (loan_date_from && loan_date_to) {
        whereClause.loan_date = {
          gte: new Date(loan_date_from).toISOString(),
          lte: new Date(loan_date_to).toISOString(),
        };
      }

      // Build payment filter for include
      let paymentFilter: any = {};
      if (payment_date_from && payment_date_to) {
        paymentFilter.payment_date = {
          gte: new Date(payment_date_from).toISOString(),
          lte: new Date(payment_date_to).toISOString(),
        };
      }

      const loanData = await this.prisma.loan.findMany({
        where: whereClause,
        include: {
          customer: true,
          installment: true,
          payment: Object.keys(paymentFilter).length > 0 ? {
            where: paymentFilter
          } : true,
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
        }, 0);

        const nextDueInstallment = loan.installment
          .filter(inst => inst.installment_date)
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
          loanAmount: parseFloat(loan.principal_amount || '0').toFixed(2),
          payableAmount: parseFloat(loan.payment_per_term || '0').toFixed(2),
          deposit: parseFloat(loan.deposit_amount || '0').toFixed(2),
          out: (parseFloat(loan.principal_amount || '0') - parseFloat(loan.deposit_amount || '0')).toFixed(2),
          dueDate: nextDueInstallment?.installment_date || '',
          dueAmount: parseFloat(nextDueInstallment?.due_amount || '0').toFixed(2),
          totalAmountReceived: totalAmountReceived.toFixed(2),
          estimatedProfit: parseFloat(loan.estimated_profit || '0').toFixed(2),
          actualProfit: parseFloat(loan.actual_profit || '0').toFixed(2)
        };
      });

      return formattedData;
    }

    if (report_type === 'payment') {
      // Build loan filter conditions
      let loanWhereClause: any = {
        deleted: false
      };

      // Add loan date filter if provided
      if (loan_date_from && loan_date_to) {
        loanWhereClause.loan_date = {
          gte: new Date(loan_date_from).toISOString(),
          lte: new Date(loan_date_to).toISOString(),
        };
      }

      // Build payment filter for include
      let paymentFilter: any = {};
      if (payment_date_from && payment_date_to) {
        paymentFilter.payment_date = {
          gte: new Date(payment_date_from).toISOString(),
          lte: new Date(payment_date_to).toISOString(),
        };
      }

      // Fetch loans with their payments
      const loanData = await this.prisma.loan.findMany({
        where: loanWhereClause,
        include: {
          customer: true,
          installment: true,
          payment: Object.keys(paymentFilter).length > 0 ? {
            where: paymentFilter,
            orderBy: {
              payment_date: 'asc'
            }
          } : {
            orderBy: {
              payment_date: 'asc'
            }
          },
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

      // Flatten the data to return payment records
      const formattedPaymentData = [];
      
      loanData.forEach(loan => {
        loan.payment.forEach(payment => {
          formattedPaymentData.push({
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
          });
        });
      });

      return formattedPaymentData;
    }

    return [];
  }

  async getUserExpenses(data: GetUserExpensesDto): Promise<UserExpensesResponse[]> {
    const { agents, fromDate, toDate } = data;
    
    const fromDateObj = new Date(fromDate);
    const toDateObj = new Date(toDate);
    
    // Extract years from the date range
    const fromYear = fromDateObj.getFullYear();
    const toYear = toDateObj.getFullYear();
    
    // Generate array of years to query
    const years: number[] = [];
    for (let year = fromYear; year <= toYear; year++) {
      years.push(year);
    }
    
    // Fetch users
    const users = await this.prisma.user.findMany({
      where: {
        id: {
          in: agents
        },
        deleted: {
          not: true
        }
      },
      select: {
        id: true,
        name: true,
        generate_id: true, // Added to get the agent's generate_id
      }
    });

    // Fetch expenses for all users and years
    const expenses = await this.prisma.expenses.findMany({
      where: {
        user_id: {
          in: agents
        },
        year: {
          in: years.map(y => y.toString())
        },
        deleted: {
          not: true
        }
      },
      select: {
        id: true,
        user_id: true,
        year: true,
        jan: true,
        feb: true,
        mar: true,
        apr: true,
        may: true,
        jun: true,
        jul: true,
        aug: true,
        sep: true,
        oct: true,
        nov: true,
        dec: true,
      }
    });

    // Fetch payments within the date range for loans supervised by these users
    const payments = await this.prisma.payment.findMany({
      where: {
        payment_date: {
          gte: fromDateObj,
          lte: toDateObj
        },
        loan: {
          OR: [
            {
              supervisor: {
                in: agents
              }
            },
            {
              supervisor_2: {
                in: agents
              }
            }
          ]
        }
      },
      select: {
        id: true,
        amount: true,
        payment_date: true,
        type: true,
        loan: {
          select: {
            supervisor: true,
            supervisor_2: true
          }
        }
      },
      orderBy: {
        payment_date: 'asc'
      }
    });

    // Helper function to get expense value for a specific month
    const getExpenseForMonth = (userId: string, year: number, month: number): number => {
      const userExpenses = expenses.filter(exp => exp.user_id === userId && exp.year === year.toString());
      if (userExpenses.length === 0) return 0;

      const expense = userExpenses[0];
      const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const monthField = monthNames[month - 1];
      
      return parseFloat(expense[monthField as keyof typeof expense] as string || '0');
    };

    // Helper function to generate monthly breakdown
    const generateMonthlyBreakdown = (userId: string): MonthlyBreakdown[] => {
      const monthlyData: { [key: string]: MonthlyBreakdown } = {};

      // Initialize months between fromDate and toDate
      const current = new Date(fromDateObj);
      while (current <= toDateObj) {
        const year = current.getFullYear();
        const month = current.getMonth() + 1; // getMonth() returns 0-11, we need 1-12
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;

        monthlyData[monthKey] = {
          month: monthKey,
          totalPaymentIn: 0,
          totalPaymentOut: 0,
          balance: 0,
          expense: getExpenseForMonth(userId, year, month),
          finalBalance: 0,
          summaryPrevious: {
            totalPaymentIn: 0,
            totalPaymentOut: 0,
            totalExpenses: 0,
            balance: 0
          }
        };

        // Move to next month
        current.setMonth(current.getMonth() + 1);
      }

      // Filter payments for this user
      const userPayments = payments.filter(payment => 
        payment.loan?.supervisor === userId || payment.loan?.supervisor_2 === userId
      );

      // Process payments and group by month
      userPayments.forEach(payment => {
        if (payment.payment_date) {
          const paymentDate = new Date(payment.payment_date);
          const year = paymentDate.getFullYear();
          const month = paymentDate.getMonth() + 1;
          const monthKey = `${year}-${String(month).padStart(2, '0')}`;

          if (monthlyData[monthKey]) {
            const amount = parseFloat(payment.amount || '0');
            
            if (payment.type === 'In') {
              monthlyData[monthKey].totalPaymentIn += amount;
            } else if (payment.type === 'Out') {
              monthlyData[monthKey].totalPaymentOut += amount;
            }
          }
        }
      });

      // Calculate balance and finalBalance for each month
      Object.values(monthlyData).forEach(monthData => {
        monthData.balance = monthData.totalPaymentIn - monthData.totalPaymentOut;
        monthData.finalBalance = monthData.balance - monthData.expense;
      });

      // Sort months chronologically
      const sortedMonths = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));

      // Calculate cumulative summaries (summaryPrevious)
      let cumulativePaymentIn = 0;
      let cumulativePaymentOut = 0;
      let cumulativeExpenses = 0;

      sortedMonths.forEach(monthData => {
        // Add current month's values to cumulative totals
        cumulativePaymentIn += monthData.totalPaymentIn;
        cumulativePaymentOut += monthData.totalPaymentOut;
        cumulativeExpenses += monthData.expense;

        // Set summary for this month (including current month)
        monthData.summaryPrevious = {
          totalPaymentIn: cumulativePaymentIn,
          totalPaymentOut: cumulativePaymentOut,
          totalExpenses: cumulativeExpenses,
          balance: cumulativePaymentIn - cumulativePaymentOut
        };
      });

      return sortedMonths;
    };

    // Generate response for each user
    const result: UserExpensesResponse[] = users.map(user => ({
      agentId: user.generate_id || user.id, // Use generate_id if available, fallback to id
      agentName: user.name || '',
      monthlyBreakdown: generateMonthlyBreakdown(user.id)
    }));

    return result;
  }

  // Alternative method that filters by specific months based on the date range
  async getUserExpensesByMonth(data: GetUserExpensesDto): Promise<UserExpensesResponse[]> {
    // This method now returns the same format as getUserExpenses
    return this.getUserExpenses(data);
  }
  
  // Additional helper method to get agent summary
  async getAgentSummary(agentIds: string[], startDate: Date, endDate: Date) {
    const agents = await this.prisma.user.findMany({
      where: {
        id: { in: agentIds },
        deleted: { not: true }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    });

    return agents;
  }


  async getSalesReport(data: GetSalesReportDto) {
    const { agents, fromDate, toDate } = data;
    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);

    // Set time to beginning and end of day for accurate comparison
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    // Get agent details
    const agentDetails = await this.prisma.user.findMany({
      where: {
        id: { in: agents },
        deleted: { not: true },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const agentReports = [];

    // Process each agent individually
    for (const agent of agentDetails) {
      // 1. Get customer count created by agents within date range
      const customersInRange = await this.prisma.customer.findMany({
        where: {
          agent_id: agent.id,
          created_at: {
            gte: startDate,
            lte: endDate,
          },
          deleted: { not: true },
          status: 'Success'
        },
        select: { id: true },
      });

      // 2. Get total loans for customers in range
      const loansForCustomersInRange = await this.prisma.loan.findMany({
        where: {
          customer_id: { in: customersInRange.map(c => c.id) },
          deleted: { not: true },
        },
        select: { id: true },
      });

      // 3. Get all customers created by agents (no date filter)
      const allCustomersByAgents = await this.prisma.customer.findMany({
        where: {
          agent_id: agent.id,
          deleted: { not: true },
          status: 'Success'
        },
        select: { id: true, created_at: true },
      });

      // 4. Get loans for all customers by agents
      const loansForAllCustomers = await this.prisma.loan.findMany({
        where: {
          customer_id: { in: allCustomersByAgents.map(c => c.id) },
          deleted: { not: true },
        },
        select: {
          id: true,
          estimated_profit: true,
          actual_profit: true
        },
      });

      // 5. Get payments for loans from point 4
      const paymentsForLoansInRange = await this.prisma.payment.findMany({
        where: {
          loan_id: { in: loansForAllCustomers.map(l => l.id) },
        },
        select: {
          type: true,
          amount: true,
        },
      });

      // Calculate payments and profits for loans in range
      const paymentsInRangeCalculation = this.calculatePaymentsAndProfits(
        paymentsForLoansInRange,
        loansForAllCustomers
      );

      // 6. Get customers created by agents outside the date range
      const customersOutsideRange = allCustomersByAgents.filter(customer => {
        const createdAt = new Date(customer.created_at);
        return createdAt < startDate || createdAt > endDate;
      });

      // 7. Get loans for customers outside range, also created outside date range
      const loansOutsideRange = await this.prisma.loan.findMany({
        where: {
          customer_id: { in: customersOutsideRange.map(c => c.id) },
          created_at: {
            not: {
              gte: startDate,
              lte: endDate,
            },
          },
          deleted: { not: true },
        },
        select: {
          id: true,
          estimated_profit: true,
          actual_profit: true
        },
      });

      // 8. Get payments for loans from point 7
      const paymentsForLoansOutsideRange = await this.prisma.payment.findMany({
        where: {
          loan_id: { in: loansOutsideRange.map(l => l.id) },
        },
        select: {
          type: true,
          amount: true,
        },
      });

      // Calculate payments and profits for loans outside range
      const paymentsOutsideRangeCalculation = this.calculatePaymentsAndProfits(
        paymentsForLoansOutsideRange,
        loansOutsideRange
      );

      agentReports.push({
        agent_id: agent.id,
        agentName: agent.name,
        // First Col.
        newCustomers: customersInRange.length,
        totalLoanCount: loansForAllCustomers.length,
        totalCustomer: allCustomersByAgents.length,
        
        // customersInRange: {
        //   count: customersInRange.length,
        //   totalLoans: loansForCustomersInRange.length,
        // },
        customersInsideRange: {
          count: customersInRange.length,
          loansInRange: loansForCustomersInRange.length,
          payments: paymentsInRangeCalculation.payments,
          profits: paymentsInRangeCalculation.profits,
        },
        customersOutsideRange: {
          count: customersOutsideRange.length,
          loansOutsideRange: loansOutsideRange.length,
          payments: paymentsOutsideRangeCalculation.payments,
          profits: paymentsOutsideRangeCalculation.profits,
        },
        estimatedProfit: paymentsInRangeCalculation.profits.estimatedProfit + paymentsOutsideRangeCalculation.profits.estimatedProfit,
        actualProfit: paymentsInRangeCalculation.profits.actualProfit + paymentsOutsideRangeCalculation.profits.actualProfit
      });
    }
    return agentReports;
  }

  private calculatePaymentsAndProfits(
    payments: Array<{ type: string | null; amount: string | null }>,
    loans: Array<{ estimated_profit: string | null; actual_profit: string | null }>
  ) {
    const paymentCalculation = payments.reduce(
      (acc, payment) => {
        const amount = parseFloat(payment.amount || '0');
        if (payment.type === 'In') {
          acc.totalIn += amount;
        } else if (payment.type === 'Out') {
          acc.totalOut += amount;
        }
        return acc;
      },
      { totalIn: 0, totalOut: 0 }
    );

    const profitCalculation = loans.reduce(
      (acc, loan) => {
        acc.estimatedProfit += parseFloat(loan.estimated_profit || '0');
        acc.actualProfit += parseFloat(loan.actual_profit || '0');
        return acc;
      },
      { estimatedProfit: 0, actualProfit: 0 }
    );

    return {
      payments: paymentCalculation,
      profits: profitCalculation,
    };
  }
}
