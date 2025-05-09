import { Injectable } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { addDays, addWeeks, addMonths, addYears, format } from 'date-fns';
import { pickBy } from 'lodash';
import { RunningNumberGenerator } from 'src/common/utils';


@Injectable()
export class LoanService {
  constructor(private prisma: PrismaService,
    private utilService:RunningNumberGenerator
  ) {}

  generateUniqueAlphanumeric(length: number): string {
    const generatedStrings = new Set<string>();
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let uniqueString: string;

    do {
      uniqueString = Array.from({ length }, () =>
        characters.charAt(Math.floor(Math.random() * characters.length)),
      ).join('');
    } while (generatedStrings.has(uniqueString));

    generatedStrings.add(uniqueString);
    return uniqueString;
  }

  async findOne(id: string) {
    const loadData = await this.prisma.loan.findFirst({
      include: {
        customer: true,
        installment: true,
        payment:true,
        loan_share: true,
        user: true,
        user_2: true,
      },
      where: { generate_id: id },
    });
    const getLeadUser = await this.prisma.user.findFirst({
      where: { id: loadData.user.supervisor },
    })
    return {...loadData, getLeadUser}
  }

  async findAll(page: number, limit: number, filter?: string) {
    const skip = (page - 1) * limit;
    // Define the base query parameters
    const queryParams: any = {
      skip,
      take: limit,
      orderBy: {
        created_at: 'desc' // Add sorting by created_at in descending order
      },
      include: {
        customer: true,
        installment: {
          where: { deleted: false },
        },
        loan_share: {
          where: { deleted: false },
        },
        user: true,
        user_2: true,
      }
    };
    
    // Only add where clause if filter is provided and not empty
    if (filter && filter.trim() !== '') {
      queryParams.where = {
        OR: [
          // Search by loan's generate_id
          { generate_id: { contains: filter, mode: 'insensitive' } },
          // Search by customer's generate_id, name, ic, or passport
          {
            customer: {
              OR: [
                { generate_id: { contains: filter, mode: 'insensitive' } },
                { name: { contains: filter, mode: 'insensitive' } },
                { ic: { contains: filter, mode: 'insensitive' } },
                { passport: { contains: filter, mode: 'insensitive' } }
              ]
            }
          },
          // Search by user's name or generate_id (supervisor 1)
          {
            user: {
              OR: [
                { name: { contains: filter, mode: 'insensitive' } },
                { generate_id: { contains: filter, mode: 'insensitive' } }
              ]
            }
          },
          // Search by user's name or generate_id (supervisor 2)
          {
            user_2: {
              OR: [
                { name: { contains: filter, mode: 'insensitive' } },
                { generate_id: { contains: filter, mode: 'insensitive' } }
              ]
            }
          }
        ]
      };
    }
    queryParams.where = { ...queryParams.where, deleted: false } // Remove any undefined or null values from the where clause
  
    // Execute the query with the constructed parameters
    const data = await this.prisma.loan.findMany(queryParams);
    const total = await this.prisma.loan.count({
      where: {
        deleted: false,
      }
    });
    return {
      data,
      total,
      page: page,
      limit: limit,
    };

  }

  async create(createLoanDto) {
    const generateId = await this.utilService.generateUniqueNumber('LN');
    console.log(generateId,'generatedid');
    // const calculateRepaymentDates = await this.calculateRepaymentDates(createLoanDto.repayment_date, createLoanDto.repayment_term, createLoanDto.unit_of_date);
    const calculateRepaymentDates = await this.getInstallmentDates(
      createLoanDto.repayment_date,
      createLoanDto.unit_of_date,
      createLoanDto.date_period,
      createLoanDto.repayment_term,
    );
    const loadData = await this.prisma.loan.create({
      data: {
        generate_id: generateId,
        customer: { connect: { id: createLoanDto.customer_id } },
        user: { connect: { id: createLoanDto.supervisor } },
        ...(createLoanDto.supervisor_2 && { user_2: { connect: { id: createLoanDto.supervisor_2 } } }),
        principal_amount: createLoanDto.principal_amount.toString(),
        deposit_amount: createLoanDto.deposit_amount.toString(),
        application_fee: createLoanDto.application_fee.toString(),
        unit_of_date: createLoanDto.unit_of_date.toString(),
        date_period: createLoanDto.date_period.toString(),
        repayment_term: createLoanDto.repayment_term.toString(),
        interest: createLoanDto.interest.toString(),
        repayment_date: createLoanDto.repayment_date.toString(),
        loan_remark: createLoanDto.loan_remark.toString(),
        status: createLoanDto.status,
        amount_given: createLoanDto.amount_given?.toString(),
        interest_amount: createLoanDto.interest_amount?.toString(),
        payment_per_term: createLoanDto.payment_per_term?.toString(),
        actual_profit: createLoanDto.actual_profit?.toString(),
        estimated_profit: createLoanDto.estimated_profit?.toString(),
        loan_date:createLoanDto.loan_date,
        created_by: createLoanDto.userid,
        updated_by: createLoanDto.userid
      },
    });

    const installmentData = await Promise.all(
      calculateRepaymentDates.map(async (date, index) => {
        const generateId = await this.utilService.generateUniqueNumber('IN');
        await this.prisma.installment.create({
          data: {
            generate_id: generateId,
            installment_date: format(date, 'yyyy-MM-dd'),
            loan: { connect: { id: loadData.id } },
            created_by: createLoanDto.userid,
          },
        });
      }),
    );

    const paymentData = await this.prisma.payment.create({
      data: {
        type: 'Out',
        payment_date: createLoanDto.loan_date,
        amount: (Number(createLoanDto.principal_amount)-(Number(createLoanDto.deposit_amount)+Number(createLoanDto.application_fee)))?.toString(),
        balance: (Number(createLoanDto.principal_amount)-(Number(createLoanDto.deposit_amount)))?.toString(),
        account_details: 'Loan Disbursement',
        loan: { connect: { id: loadData.id } },
        created_by: createLoanDto.userid,
      },
    });
    return loadData;
  }

  async update(id: string, updateLoanDto: UpdateLoanDto) {
    const authUserId = updateLoanDto.userid;
    if (updateLoanDto.installment) {
      const installments = updateLoanDto.installment;
      delete updateLoanDto.installment;
      await Promise.all(
        installments.map(async (installment) => {
          installment.updated_by = authUserId;
          await this.prisma.installment.update({
            where: { id: installment.id },
            data: installment,
          });
        }),
      );
    }
    if (updateLoanDto.loan_share) {
      const loanShares = updateLoanDto.loan_share;
      delete updateLoanDto.loan_share;
      await Promise.all(
        loanShares.map(async (loanShare) => {
          loanShare.updated_by = authUserId;
          await this.prisma.loan_share.update({
            where: { id: loanShare.id },
            data: loanShare,
          });
        }),
      );
    }
    // const user = updateLoanDto.supervisor;
    // const user_2 = updateLoanDto.supervisor_2;
    delete updateLoanDto.supervisor;
    delete updateLoanDto.supervisor_2;
    delete updateLoanDto.customer_id;
    delete updateLoanDto.userid;
    updateLoanDto.payment_per_term = updateLoanDto.payment_per_term?.toString();
    updateLoanDto.interest_amount = updateLoanDto.interest_amount?.toString();
    return this.prisma.loan.update({
      where: { id },
      data: updateLoanDto,
    });
  }

  async updateInstallment(id: string, installments: any, authUserId: string) {
    if (installments.length > 0) {
      await Promise.all(
        installments.map(async (installment) => {
          // console.log(installment, 'installments');
          installment.updated_by = authUserId;
          if (installment.id) {
            await this.prisma.installment.update({
              where: { id: installment.id },
              data: installment,
            });
          } else {
            if (!installment.generate_id) {
              const generateId = await this.utilService.generateUniqueNumber('IN');
              installment.generate_id = generateId;
            }
            if (!installment.loan_id) {
              const loan = await this.prisma.loan.findFirst({
                where: { generate_id: id },
              });
              installment.loan_id = loan.id;
            }
            if (!installment.receiving_date) {
              installment.receiving_date = new Date().toISOString();
            }
            await this.prisma.installment.create({
              data: installment,
            });
          }
        }),
      );
      return this.prisma.loan.findFirst({
        where: { generate_id: id },
      });
    }
    return {}
  }

  // async delete(id: string) {
  //   const deleteInstallment = await this.prisma.installment.deleteMany({
  //     where: { loan_id: id },
  //   });
  //   const loadShare = await this.prisma.loan_share.deleteMany({
  //     where: { loan_id: id },
  //   });
  //   return this.prisma.loan.delete({
  //     where: { id },
  //   });
  // }

  async delete(id: string) {
    const deleteInstallment = await this.prisma.installment.updateMany({
      where: { loan_id: id },
      data: { deleted: true },
    });
  
    const loadShare = await this.prisma.loan_share.updateMany({
      where: { loan_id: id },
      data: { deleted: true },
    });
  
    return this.prisma.loan.update({
      where: { id },
      data: { deleted: true },
    });
  }

  createInstallmentDates() {
    const unitPeriods = ['day', 'week', 'month', 'year'] as const;
    type UnitPeriod = (typeof unitPeriods)[number];

    const repaymentDate = new Date('2025-02-01'); // Starting repayment date
    const repaymentTerm = 5; // Number of repayments
    const unitPeriod: UnitPeriod = 'day'; // Change this to 'day', 'week', 'month', or 'year'

    function calculateRepaymentDates(
      startDate: Date,
      term: number,
      unit: UnitPeriod,
    ): Date[] {
      const dates: Date[] = [];
      let currentDate = startDate;

      for (let i = 0; i < term; i++) {
        switch (unit) {
          case 'day':
            currentDate = addDays(currentDate, 1);
            break;
          case 'week':
            currentDate = addWeeks(currentDate, 1);
            break;
          case 'month':
            currentDate = addMonths(currentDate, 1);
            break;
          case 'year':
            currentDate = addYears(currentDate, 1);
            break;
        }
        dates.push(new Date(currentDate));
      }

      return dates;
    }

    const repaymentDates = calculateRepaymentDates(
      repaymentDate,
      repaymentTerm,
      unitPeriod,
    );
    console.log(repaymentDates.map((date) => date.toDateString()));
  }

  calculateRepaymentDates(startDate: Date, term: number, unit: any): Date[] {
    const dates: Date[] = [];
    let currentDate: any = startDate;

    for (let i = 0; i < term; i++) {
      switch (unit) {
        case 'day':
          currentDate = addDays(currentDate, 1);
          break;
        case 'week':
          currentDate = addWeeks(currentDate, 1);
          break;
        case 'month':
          currentDate = addMonths(currentDate, 1);
          break;
        case 'year':
          currentDate = addYears(currentDate, 1);
          break;
      }
      dates.push(new Date(currentDate));
    }

    return dates;
  }

  getInstallmentDates(
    startDate: string,
    period: any,
    interval: number,
    repaymentTerm: number,
  ): string[] {
    const dates: string[] = [];
    let currentDate = new Date(startDate);

    for (let i = 0; i < repaymentTerm; i++) {
      dates.push(
        `${currentDate.getDate()} ${currentDate.toLocaleString('default', { month: 'short' })} ${currentDate.getFullYear()}`,
      );

      switch (period.toLowerCase()) {
        case 'day':
          currentDate.setDate(currentDate.getDate() + interval);
          break;
        case 'week':
          currentDate.setDate(currentDate.getDate() + interval * 7);
          break;
        case 'month':
          currentDate.setMonth(currentDate.getMonth() + interval);
          break;
        case 'year':
          currentDate.setFullYear(currentDate.getFullYear() + interval);
          break;
        default:
          throw new Error('Invalid period type');
      }
    }

    return dates;
  }

  async getLoanStatusByPassport(id: string) {
    try {
      // Find all matching customers
      const customers = await this.prisma.customer.findMany({
        where: {
          OR: [
            { ic: { contains: id, mode: 'insensitive' } },
            { passport: { contains: id, mode: 'insensitive' } },
            { name: { contains: id, mode: 'insensitive' } }
          ],
        },
      });
  
      if (!customers.length) {
        return [];
      }
  
      // For each customer, fetch their loans (if any)
      const customersWithLoans = await Promise.all(
        customers.map(async (customer) => {
          const loans = await this.prisma.loan.findMany({
            where: { 
              customer_id: customer.id 
            },
            include: {
              installment: true,
              loan_share: true,
              user: true,
              customer: true
            },
          });
          
          // Return customer with their loans (which may be an empty array)
          return {
            customer,
            loans
          };
        })
      );
  
      return customersWithLoans;
    } catch (error) {
      console.error('Error fetching loan status:', error);
      return [];
    }
  }
  async getLoanStatusByPassport_new(query: string) {
    try {
      const customers = await this.prisma.customer.findMany({
        where: {
          deleted_at: null,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { ic: { contains: query, mode: 'insensitive' } },
            { passport: { contains: query, mode: 'insensitive' } },
          ]
        },
      });
  
      const customerIds = customers.map((customer: any) => customer.id);
  
      const loanStatusCounts = await this.prisma.loan.groupBy({
        by: ['customer_id', 'status', 'supervisor'],
        where: {
          customer_id: { in: customerIds },
        },
        _count: {
          status: true,
        },
      });
  
      const statusMap = loanStatusCounts.reduce((acc: any, item: any) => {
        if (!acc[item.customer_id]) {
          acc[item.customer_id] = {
            completedStatusCounts: 0,
            normalStatusCounts: 0,
            badDebtStatusCounts: 0,
            badDebtCompletedStatusCounts: 0,
          };
        }
        switch (item.status) {
          case 'Completed':
            acc[item.customer_id].completedStatusCounts = item._count.status;
            break;
          case 'Normal':
            acc[item.customer_id].normalStatusCounts = item._count.status;
            break;
          case 'Bad Debt':
            acc[item.customer_id].badDebtStatusCounts = item._count.status;
            break;
          case 'Bad Debt Completed':
            acc[item.customer_id].badDebtCompletedStatusCounts = item._count.status;
            break;
        }
        return acc;
      }, {});
  
      customers.forEach((customer: any) => {
        const counts = statusMap[customer.id] || {
          completedStatusCounts: 0,
          normalStatusCounts: 0,
          badDebtStatusCounts: 0,
          badDebtCompletedStatusCounts: 0,
        };
        customer.completedStatusCounts = counts.completedStatusCounts;
        customer.normalStatusCounts = counts.normalStatusCounts;
        customer.badDebtStatusCounts = counts.badDebtStatusCounts;
        customer.badDebtCompletedStatusCounts = counts.badDebtCompletedStatusCounts;
      });
      console.log('customerscustomerscustomerscustomerscustomers');
      console.log(customers);
      console.log('customerscustomerscustomerscustomerscustomerscustomers');
      return customers;
    } catch (err) {
      console.error('Database Error:', err);
      throw new Error('Failed to fetch all customers.');
    }
  }

  async getLoanCountByGroups(searchTerm?: string) {

    // Find all matching customers with needed fields
    const customers = await this.prisma.customer.findMany({
      where: searchTerm
      ? {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } },
            { ic: { contains: searchTerm, mode: 'insensitive' } },
            { passport: { contains: searchTerm, mode: 'insensitive' } },
            { generate_id: { contains: searchTerm, mode: 'insensitive' } },
          ],
          deleted: false,
        }
      : { deleted: false },
      select: {
        id: true,
        name: true,
        ic: true,
        passport: true,
        generate_id: true,
      },
    });

    // Get customer IDs
    const customerIds = customers.map((customer) => customer.id);
    
    // Create a map of customer IDs to customer details for easier lookup
    const customerMap = new Map();
    customers.forEach(customer => {
      customerMap.set(customer.id, {
        name: customer.name,
        ic: customer.ic,
        passport: customer.passport,
        generate_id: customer.generate_id,
      });
    });

    // Group loans by customer_id, status, and supervisor, and count them
    const loanGroups = await this.prisma.loan.groupBy({
      by: ['customer_id', 'status', 'supervisor'],
      where: {
        customer_id: {
          in: customerIds,
        },
        deleted: false,
      },
      _count: {
        id: true,
      },
    });

    // Fetch all loans for these customers to get their IDs for installment lookup
    const loans = await this.prisma.loan.findMany({
      where: {
        customer_id: {
          in: customerIds,
        },
        deleted: false,
      },
      select: {
        id: true,
        customer_id: true,
      },
    });

    // Map loans to customers for easier lookup
    const customerToLoansMap = new Map();
    loans.forEach(loan => {
      if (!customerToLoansMap.has(loan.customer_id)) {
        customerToLoansMap.set(loan.customer_id, []);
      }
      customerToLoansMap.get(loan.customer_id).push(loan.id);
    });

    // Get installment dates for all these loans
    const currentDate = new Date().toISOString().split('T')[0]; // Current date in YYYY-MM-DD format
    
    // Process installments for each customer
    const customerInstallmentDates = new Map();
    
    // Process each customer's loans to find installment dates
    for (const [customerId, loanIds] of customerToLoansMap.entries()) {
      if (!loanIds || loanIds.length === 0) continue;
      
      // Get all installments for this customer's loans
      const installments = await this.prisma.installment.findMany({
        where: {
          loan_id: {
            in: loanIds,
          },
          deleted: false,
        },
        select: {
          installment_date: true,
        },
        orderBy: {
          installment_date: 'asc',
        },
      });
      
      if (installments.length === 0) {
        customerInstallmentDates.set(customerId, {
          upcoming_installment_date: null,
          last_installment_date: null,
        });
        continue;
      }
      
      // Parse dates and find upcoming and last installment dates
      let upcomingDate = null;
      let lastDate = null;
      
      // Convert installment_date strings to Date objects for comparison
      const parsedDates = installments
        .filter(inst => inst.installment_date)
        .map(inst => {
          // Assuming installment_date is in a format like YYYY-MM-DD
          return {
            original: inst.installment_date,
            date: new Date(inst.installment_date)
          };
        })
        .filter(parsed => !isNaN(parsed.date.getTime())); // Filter out invalid dates
      
      if (parsedDates.length > 0) {
        // Sort dates
        parsedDates.sort((a, b) => a.date.getTime() - b.date.getTime());
        
        // Find first date that's in the future (upcoming)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const futureDate = parsedDates.find(d => d.date >= today);
        upcomingDate = futureDate ? futureDate.original : null;
        
        // Last date is the latest one
        lastDate = parsedDates[parsedDates.length - 1].original;
      }
      
      customerInstallmentDates.set(customerId, {
        upcoming_installment_date: format(upcomingDate, 'yyyy-MM-dd'),
        last_installment_date: format(lastDate, 'yyyy-MM-dd'),
      });
    }

    // Fetch supervisor details for better context
    const supervisorIds = [...new Set(loanGroups.map(group => group.supervisor).filter(Boolean))];
    
    const supervisors = supervisorIds.length > 0 ? 
      await this.prisma.user.findMany({
        where: {
          id: {
            in: supervisorIds as string[],
          },
        },
        select: {
          id: true,
          name: true,
        },
      }) : [];

    // Create a map of supervisor IDs to names for easier lookup
    const supervisorMap = new Map();
    supervisors.forEach(supervisor => {
      supervisorMap.set(supervisor.id, supervisor.name);
    });

    // Initialize result map with all customers
    const customerGroupedData = new Map();
    
    // First ensure all customers are in the result, even if they have no loans
    customers.forEach(customer => {
      customerGroupedData.set(customer.id, {
        customer_id: customer.id,
        customerDetails: customerMap.get(customer.id),
        upcoming_installment_date: customerInstallmentDates.get(customer.id)?.upcoming_installment_date || null,
        last_installment_date: customerInstallmentDates.get(customer.id)?.last_installment_date || null,
        loans: [],
        total_loan_count: 0
      });
    });
    
    // Process each loan group to add loan details
    loanGroups.forEach(group => {
      const customerId = group.customer_id;
      
      if (!customerId) return; // Skip if no customer ID
      
      // The customer should already be in our map from the initialization step
      const customerData = customerGroupedData.get(customerId);
      
      if (!customerData) return; // Skip if customer data not found (shouldn't happen)
      
      // Add this loan group to the customer's loans array
      customerData.loans.push({
        status: group.status,
        supervisor_id: group.supervisor,
        supervisor_name: group.supervisor ? supervisorMap.get(group.supervisor) : null,
        loan_count: group._count.id
      });
      
      // Increment the total loan count for this customer
      customerData.total_loan_count += group._count.id;
    });
    
    // Convert map to array for the final result
    return Array.from(customerGroupedData.values());
  }

  async fetchCurrentUserCustomer(query?: string) {
    if (!query || query.trim() === '') {
      return { data: [] };
    }
    try {
  
      const currentDate = new Date().toISOString().split('T')[0]; // Returns "2025-04-02"
  
      const customersWithMatchingLoans = await this.prisma.$queryRaw`
        SELECT 
          c.id AS customer_id, 
          c.generate_id AS customer_generate_id, 
          c.name AS customer_name, 
          c.ic AS customer_ic, 
          c.passport AS customer_passport, 
          c.deleted_at AS customer_deleted_at,   
          l.id AS loan_id, 
          l.generate_id AS loan_generate_id, 
          l.customer_id AS loan_customer_id, 
          l.amount_given AS loan_amount, 
          l.interest AS loan_interest_rate, 
          l.status AS loan_status, 
          l.supervisor AS loan_agent_1_id, 
          l.supervisor_2 AS loan_agent_2_id, 
          i.generate_id AS installment_generate_id, 
          i.loan_id AS installment_loan_id, 
          i.due_amount AS installment_amount, 
          i.installment_date AS installment_date, 
          i.status AS installment_status,
          -- Agent 1 Details
          u1.id AS agent_1_id,
          u1.name AS agent_1_name,
          u1.email AS agent_1_email,
          -- Agent 2 Details
          u2.id AS agent_2_id,
          u2.name AS agent_2_name,
          u2.email AS agent_2_email
          
        FROM customer c
        LEFT JOIN loan l ON c.id = l.customer_id
        LEFT JOIN installment i ON l.id = i.loan_id 
            AND i.installment_date::TEXT::DATE > ${currentDate}::DATE -- Fixes Date Binding
        
        -- Join Agent 1 (User)
        LEFT JOIN "user" u1 ON l.supervisor = u1.id
  
        -- Join Agent 2 (User)
        LEFT JOIN "user" u2 ON l.supervisor_2 = u2.id
  
        WHERE c.deleted_at IS NULL
          AND (
              c.generate_id ILIKE ${'%' + query + '%'}
              OR c.name ILIKE ${'%' + query + '%'}
              OR c.ic ILIKE ${'%' + query + '%'}
              OR c.passport ILIKE ${'%' + query + '%'}
          )
        ORDER BY i.installment_date DESC
      `;
  
      console.log('customersWithMatchingLoans', customersWithMatchingLoans);
      
      return { data: customersWithMatchingLoans || [] };
    } catch (error) {
      console.error('Error fetching customer data:', error);
      return { data: [] };
    }
  }
}
