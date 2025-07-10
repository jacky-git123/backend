import { Injectable } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { addDays, addWeeks, addMonths, addYears, format } from 'date-fns';
import { pickBy } from 'lodash';
import { RunningNumberGenerator } from 'src/common/utils';


@Injectable()
export class LoanService {
  constructor(private prisma: PrismaService,
    private utilService: RunningNumberGenerator
  ) { }

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

  async findOne(id: string, authUserId?: string) {
    const authUser = await this.prisma.user.findFirst({
      where: { id: authUserId },
      select: {
        role: true,
        id: true,
        supervisor: true,
      }
    });
    

    let supervisorId = null;
    if (authUser.role === 'AGENT') {
      supervisorId = authUser.supervisor;
    } else if (authUser.role === 'LEAD') {
      supervisorId = authUser.id;
    }

    // Build where clause with permission filtering
    let whereClause: any = {
      generate_id: id,
      deleted: false
    };

    // Add permission-based filtering for non-SUPER_ADMIN users
    if (authUser.role !== 'SUPER_ADMIN' && authUser.role !== 'ADMIN') {
      const permissionConditions = [
        { created_by: authUserId },
        { supervisor: authUserId },
        { supervisor_2: authUserId }
      ];

      if (supervisorId) {
        permissionConditions.push(
          { created_by: supervisorId },
          { supervisor: supervisorId },
          { supervisor_2: supervisorId }
        );
      }

      whereClause.OR = permissionConditions;
    }

    

    const loadData = await this.prisma.loan.findFirst({
      include: {
        customer: true,
        installment: true,
        payment: true,
        loan_share: true,
        user: true,
        user_2: true,
      },
      where: whereClause,
    });

    if (!loadData) {
      return null; // or throw an error if preferred
    }

    const getLeadUser = await this.prisma.user.findFirst({
      where: { id: loadData.user?.supervisor },
    });

    return { ...loadData, getLeadUser };
  }

  async findAll(page: number, limit: number, filter?: string, authUserId?: string) {
    const authUser = await this.prisma.user.findFirst({
      where: { id: authUserId },
      select: {
        role: true,
        id: true,
        supervisor: true,
      }
    });
    

    let supervisorId = null;
    if (authUser.role === 'AGENT') {
      supervisorId = authUser.supervisor;
    } else if (authUser.role === 'LEAD') {
      supervisorId = authUser.id;
    }

    const skip = (page - 1) * limit;

    // Build the where clause step by step
    let whereClause: any = {
      deleted: false
    };

    // Add permission-based filtering for non-SUPER_ADMIN users
    if (authUser.role !== 'SUPER_ADMIN' && authUser.role !== 'ADMIN') {
      const permissionConditions = [
        { created_by: authUserId },
        { supervisor: authUserId },
        { supervisor_2: authUserId }
      ];

      if (supervisorId) {
        permissionConditions.push(
          { created_by: supervisorId },
          { supervisor: supervisorId },
          { supervisor_2: supervisorId }
        );
      }

      whereClause.OR = permissionConditions;
    }

    // If there's a search filter, we need to combine it with permission filtering
    if (filter && filter.trim() !== '') {
      const searchConditions = [
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
      ];

      if (authUser.role !== 'SUPER_ADMIN' && authUser.role !== 'ADMIN') {
        // For non-SUPER_ADMIN: Must match search criteria AND permission criteria
        whereClause = {
          deleted: false,
          AND: [
            { OR: searchConditions },
            { OR: whereClause.OR }
          ]
        };
      } else {
        // For SUPER_ADMIN: Only search criteria needed
        whereClause = {
          deleted: false,
          OR: searchConditions
        };
      }
    }

    // Define the query parameters
    const queryParams: any = {
      skip,
      take: limit,
      orderBy: {
        created_at: 'desc'
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
      },
      where: whereClause
    };

    

    // Execute the query with the constructed parameters
    const data = await this.prisma.loan.findMany(queryParams);


    const finalData = data.map((loan:any) => {
      
      const nextDueInstallment = loan.installment
      .filter(inst => inst.installment_date) // remove entries without a date
      .sort((a, b) => new Date(a.installment_date).getTime() - new Date(b.installment_date).getTime())
      .find(inst => !inst.status || inst.status == null); 
      loan.nextPaymentDate = nextDueInstallment ? nextDueInstallment.installment_date : null;
      return loan;
    })

    // Fix: Use the same where clause for count to get accurate total
    const total = await this.prisma.loan.count({
      where: whereClause
    });

    return {
      data: finalData,
      total,
      page: page,
      limit: limit,
    };
  }

  async create(createLoanDto) {
    const generateId = await this.utilService.generateUniqueNumber('LN');
    const calculateRepaymentDates = await this.getInstallmentDates(
      createLoanDto.repayment_date,
      createLoanDto.unit_of_date,
      createLoanDto.date_period,
      createLoanDto.repayment_term,
    );
    createLoanDto.loan_date = format(createLoanDto.loan_date, 'yyyy-MM-dd');

    return this.prisma.$transaction(async (prisma) => {
      const loadData = await prisma.loan.create({
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
          repayment_date: new Date(createLoanDto.repayment_date + 'T00:00:00Z'),
          loan_remark: createLoanDto.loan_remark.toString(),
          status: createLoanDto.status,
          amount_given: createLoanDto.amount_given?.toString(),
          interest_amount: createLoanDto.interest_amount?.toString(),
          payment_per_term: createLoanDto.payment_per_term?.toString(),
          actual_profit: createLoanDto.actual_profit?.toString(),
          estimated_profit: createLoanDto.estimated_profit?.toString(),
          loan_date: new Date(createLoanDto.loan_date + 'T00:00:00Z'),
          created_by: createLoanDto.userid,
          updated_by: createLoanDto.userid
        },
      });

      await Promise.all(
        calculateRepaymentDates.map(async (date, index) => {console.log('date', typeof date);
          const installmentGenerateId = await this.utilService.generateUniqueNumber('IN');
          const malaysiaDate = new Date(date + 'T00:00:00Z');
          await prisma.installment.create({
            data: {
              generate_id: installmentGenerateId,
              installment_date: malaysiaDate, // Convert to ISO string
              loan: { connect: { id: loadData.id } },
              created_by: createLoanDto.userid,
            },
          });
        }),
      );

      const paymentgenerateId = await this.utilService.generateUniqueNumber('PM');
      await prisma.payment.create({
        data: {
          generate_id: paymentgenerateId,
          type: 'Out',
          payment_date: new Date(createLoanDto.loan_date + 'T00:00:00Z'),
          amount: (Number(createLoanDto.principal_amount) - (Number(createLoanDto.deposit_amount) + Number(createLoanDto.application_fee)))?.toString(),
          balance: (Number(createLoanDto.principal_amount) - (Number(createLoanDto.deposit_amount)))?.toString(),
          account_details: 'Loan Disbursement',
          loan: { connect: { id: loadData.id } },
          created_by: createLoanDto.userid,
        },
      });

      return loadData;
    });
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
      // Format date as YYYY-MM-DD
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);

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
        upcoming_installment_date: upcomingDate ? format(upcomingDate, 'yyyy-MM-dd') : null,
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

      

      return { data: customersWithMatchingLoans || [] };
    } catch (error) {
      console.error('Error fetching customer data:', error);
      return { data: [] };
    }
  }

  async fixPayment() {
    // Process loans in smaller batches to avoid long-running transactions
    const BATCH_SIZE = 10;
    let processedCount = 0;
    let totalProcessed = 0;

    // Get total count first
    const totalLoans = await this.prisma.loan.count({
      where: {
        deleted: false,
      }
    });

    // Process in batches
    while (totalProcessed < totalLoans) {
      const loans = await this.prisma.loan.findMany({
        where: {
          deleted: false,
        },
        include: {
          installment: true,
        },
        take: BATCH_SIZE,
        skip: totalProcessed,
      });

      // Process each loan individually rather than in one large Promise.all
      for (const loan of loans) {
        try {
          // Check if initial payment exists
          const existingPayment = await this.prisma.payment.findFirst({
            where: {
              loan_id: loan.id,
              type: 'Out',
            },
          });

          if (!existingPayment) {
            // Pre-generate all IDs needed for this loan before starting transaction
            // This avoids having long transactions waiting on ID generation
            const loanPaymentId = await this.utilService.generateUniqueNumber('PM');

            // Prepare IDs for installment payments too
            const installmentPaymentIds = [];
            if (loan.installment && loan.installment.length > 0) {
              const paidInstallments = loan.installment.filter(
                inst => inst.status === 'Paid' && inst.receiving_date
              );

              // Pre-generate all installment payment IDs
              for (let i = 0; i < paidInstallments.length; i++) {
                const id = await this.utilService.generateUniqueNumber('PM');
                installmentPaymentIds.push(id);
              }
            }

            // Now create the initial loan payment
            await this.prisma.payment.create({
              data: {
                generate_id: loanPaymentId,
                type: 'Out',
                payment_date: loan.loan_date,
                amount: (Number(loan.principal_amount) - (Number(loan.deposit_amount || '0') + Number(loan.application_fee || '0')))?.toString(),
                balance: (Number(loan.principal_amount) - Number(loan.deposit_amount || '0'))?.toString(),
                account_details: 'Loan Disbursement',
                loan: { connect: { id: loan.id } },
                created_by: 'c8b7e162-cd42-4c50-8d77-bb9c9b00506e',
              },
            });

            // Process installment payments one by one to avoid transaction timeout
            if (loan.installment && loan.installment.length > 0) {
              const paidInstallments = loan.installment.filter(
                inst => inst.status === 'Paid' && inst.receiving_date
              );

              for (let i = 0; i < paidInstallments.length; i++) {
                const inst = paidInstallments[i];

                await this.prisma.payment.create({
                  data: {
                    generate_id: installmentPaymentIds[i],
                    type: 'In',
                    payment_date: inst.receiving_date,
                    amount: inst.accepted_amount || inst.due_amount || '0',
                    account_details: 'Loan Installment Payment',
                    loan: { connect: { id: loan.id } },
                    installment: { connect: { id: inst.id } },
                    created_by: 'c8b7e162-cd42-4c50-8d77-bb9c9b00506e',
                  },
                });

                // Small delay between operations to avoid database contention
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            }
          }

          processedCount++;
        } catch (error) {
          console.error(`Error processing loan ID ${loan.id}: ${error.message}`);
          // Continue with the next loan instead of failing the entire batch
        }
      }

      totalProcessed += loans.length;
      

      // Add delay between batches to reduce database pressure
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return `Payment fixed successfully. Processed ${processedCount} loans.`;
  }

  async updateLoanProfit(loanId: string, actual_profit: string) {
    return this.prisma.loan.update({
      where: { id: loanId },
      data: { actual_profit },
    });
  }

  async getLoanChecksByAgent(agents: string[], fromDate: string, toDate: string, userid: string, page: number = 1) {
    type LoanWithFlag = Awaited<ReturnType<typeof this.prisma.loan.findMany>>[number] & {
      hasOtherLoanPaymentInPeriod?: boolean;
      installment: Array<{
        id: string;
        installment_date: any;
        due_amount?: string;
        status?: string | null;
        [key: string]: any;
      }>;
      user?: {
        name?: string | null;
        [key: string]: any;
      } | null;
      customer?: {
        ic?: string | null;
        name?: string | null;
        [key: string]: any;
      } | null;
      nextInstallmentDate?: string | null;
      nextInstallmentAmount?: string | null;
    };

    const loans = await this.prisma.loan.findMany({
      skip: (page - 1) * 10,
      take: 10,
      where: {
        loan_date : {
          gte: fromDate ? new Date(fromDate) : undefined,
          lte: toDate ? new Date(toDate) : undefined,
        },
        OR: [
          { created_by: {in: agents} },
          { supervisor: {in: agents} },
          { supervisor_2: {in: agents} }
        ],
        deleted: false,
      },
      include: {
        customer: true,
        installment: true,
        user: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    }) as LoanWithFlag[];

    for (const loan of loans) {
      if (!loan.customer_id) continue;

      // Find all other loans for this customer (excluding the current loan)
      const otherLoans = await this.prisma.loan.findMany({
        where: {
          customer_id: loan.customer_id,
          id: { not: loan.id },
          deleted: false,
        },
        select: { id: true }
      });

      if (otherLoans.length === 0) {
        loan.hasOtherLoanPaymentInPeriod = false;
        // continue;
      }

      // Get all payments for these other loans within the date range
      const otherLoanIds = otherLoans.map(l => l.id);
      const payments = await this.prisma.payment.findMany({
        where: {
          loan_id: { in: otherLoanIds },
          payment_date: {
            gte: fromDate,
            lte: toDate,
          },
          type: 'In',
        },
        select: { id: true }
      });


      const nextInstallment = loan.installment
        .filter(inst => {
          if (!inst.installment_date) return false;
          const date = new Date(inst.installment_date);
          const from = fromDate ? new Date(fromDate) : null;
          const to = toDate ? new Date(toDate) : null;
          // Only include installments within the date range (inclusive)
          return (
            (!from || date >= from) &&
            (!to || date <= to)
          );
        })
        .sort((a, b) => new Date(a.installment_date).getTime() - new Date(b.installment_date).getTime())
        .find(inst => !inst.status || inst.status === null || inst.status.toLowerCase() === 'unpaid');

      loan.hasOtherLoanPaymentInPeriod = payments.length > 0;
      loan.nextInstallmentDate = nextInstallment ? nextInstallment.installment_date : null;
      loan.nextInstallmentAmount = nextInstallment ? nextInstallment.due_amount : loan.payment_per_term || null;
    }

    // Only return the required fields for each loan
    return loans.map(loan => ({
      agent: loan.user?.name || null,
      customerIC: loan.customer?.ic || null,
      customerName: loan.customer?.name || null,
      dueDate: loan.nextInstallmentDate || null,
      dueAmount: loan.nextInstallmentAmount || null,
      remark: loan.loan_remark || null,
      hasOtherLoanPaymentInPeriod: loan.hasOtherLoanPaymentInPeriod || false,
    }));
    return loans;
  }
}


