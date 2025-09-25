import { Injectable } from '@nestjs/common';
import { GenerateReportDto, GetSalesReportDto, GetUserExpensesDto, MonthlyBreakdown, SalesReportResponse, UserExpensesResponse } from './dto/report.dto';
import { PrismaService } from 'nestjs-prisma';
import e from 'express';

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
      // Step 1: Get all loans for this agent within the date range
      const loansInRange = await this.prisma.loan.findMany({
        where: {
          OR: [
            { supervisor: agent.id },
            { supervisor_2: agent.id }
          ],
          loan_date: {
            gte: startDate,
            lte: endDate
          },
          deleted: { not: true }
        },
        include: {
          customer: true,
          payment: true,
        }
      });

      // Step 2: For each customer in these loans, check if they have any loan before start date
      const newCustomerLoans = [];
      const oldCustomerLoans = [];
      const processedCustomers = new Set();

      for (const loan of loansInRange) {
        if (!loan.customer || processedCustomers.has(loan.customer_id)) {
          // If customer already processed, add loan to appropriate category
          const existingNewCustomer = newCustomerLoans.find(l => l.customer_id === loan.customer_id);
          const existingOldCustomer = oldCustomerLoans.find(l => l.customer_id === loan.customer_id);

          if (existingNewCustomer) {
            newCustomerLoans.push(loan);
          } else if (existingOldCustomer) {
            oldCustomerLoans.push(loan);
          }
          continue;
        }

        // Check if customer has any loan before start date
        const previousLoan = await this.prisma.loan.findFirst({
          where: {
            customer_id: loan.customer_id,
            loan_date: {
              lt: startDate
            },
            deleted: { not: true }
          }
        });

        processedCustomers.add(loan.customer_id);

        if (previousLoan) {
          // Customer has previous loan - Old Customer
          oldCustomerLoans.push(loan);
        } else {
          // Customer has no previous loan - New Customer
          newCustomerLoans.push(loan);
        }
      }

      // Step 3: Get unique customers from new customer loans
      // Check if customer's created_at falls within date range AND agent_id matches
      const uniqueCustomers = [];
      const newCustomerIds = [...new Set(newCustomerLoans.map(loan => loan.customer_id))];

      for (const customerId of newCustomerIds) {
        const customer = await this.prisma.customer.findUnique({
          where: { id: customerId }
        });

        if (customer &&
          customer.created_at >= startDate &&
          customer.created_at <= endDate &&
          customer.agent_id === agent.id) {
          uniqueCustomers.push(customer);
        }
      }

      // Step 4: Calculate stats for new customers
      const newCustomerStats = this.calculateLoanStats(newCustomerLoans);

      // Step 5: Calculate stats for old customers  
      const oldCustomerStats = this.calculateLoanStats(oldCustomerLoans);

      // Step 6: Get total counts for agent
      const totalLoanCount = await this.prisma.loan.count({
        where: {
          OR: [
            { supervisor: agent.id },
            { supervisor_2: agent.id }
          ],
          deleted: { not: true },
        },
      });

      const totalCustomerCount = await this.prisma.customer.count({
        where: {
          agent_id: agent.id,
          status: 'Success',
          deleted: { not: true }
        },
      });

      // Step 7: Build response
      agentReports.push({
        agent: agent.name,
        newUniqueCustomer: uniqueCustomers.length,
        totalLoanCount: totalLoanCount,
        totalCustomer: totalCustomerCount,

        // Total New Customer Stats
        totalNewCustomer: {
          totalCustomer: [...new Set(newCustomerLoans.map(loan => loan.customer_id))].length,
          totalLoan: newCustomerStats.totalLoans,
          totalIN: newCustomerStats.paymentsIn,
          totalOUT: newCustomerStats.paymentsOut,
          estimateProfit: newCustomerStats.estimatedProfit,
          actualProfit: newCustomerStats.actualProfit
        },

        // Total Old Customer Stats
        totalOldCustomer: {
          totalCustomer: [...new Set(oldCustomerLoans.map(loan => loan.customer_id))].length,
          totalLoan: oldCustomerStats.totalLoans,
          totalIN: oldCustomerStats.paymentsIn,
          totalOUT: oldCustomerStats.paymentsOut,
          estimateProfit: oldCustomerStats.estimatedProfit,
          actualProfit: oldCustomerStats.actualProfit
        },

        // Combined totals
        estimateProfit: newCustomerStats.estimatedProfit + oldCustomerStats.estimatedProfit,
        actualProfit: newCustomerStats.actualProfit + oldCustomerStats.actualProfit
      });
    }

    return agentReports;
  }

  private calculateLoanStats(loans: any[]) {
    let totalLoans = loans.length;
    let paymentsIn = 0;
    let paymentsOut = 0;
    let estimatedProfit = 0;
    let actualProfit = 0;

    for (const loan of loans) {
      // Add estimated and actual profit from loans
      if (loan.estimated_profit) {
        estimatedProfit += parseFloat(loan.estimated_profit) || 0;
      }
      if (loan.actual_profit) {
        actualProfit += parseFloat(loan.actual_profit) || 0;
      }

      // Calculate payments by type
      for (const payment of loan.payment) {
        const amount = parseFloat(payment.amount) || 0;
        if (payment.type === 'In') {
          paymentsIn += amount;
        } else if (payment.type === 'Out') {
          paymentsOut += amount;
        }
      }
    }

    return {
      totalLoans,
      paymentsIn,
      paymentsOut,
      estimatedProfit,
      actualProfit
    };
  }

}
