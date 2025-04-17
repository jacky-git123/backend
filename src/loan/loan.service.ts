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
    return this.prisma.loan.findFirst({
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
  
    // Execute the query with the constructed parameters
    return this.prisma.loan.findMany(queryParams);
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
          },
        });
      }),
    );

    const paymentData = await this.prisma.payment.create({
      data: {
        type: 'Out',
        payment_date: createLoanDto.repayment_date,
        amount: createLoanDto.amount_given?.toString(),
        balance: createLoanDto.amount_given?.toString(),
        account_details: 'Loan Disbursement',
        loan: { connect: { id: loadData.id } },
      },
    });
    return loadData;
  }

  async update(id: string, updateLoanDto: UpdateLoanDto) {
    if (updateLoanDto.installment) {
      const installments = updateLoanDto.installment;
      delete updateLoanDto.installment;
      await Promise.all(
        installments.map(async (installment) => {
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

  async updateInstallment(id: string, installments: any) {
    if (installments.length > 0) {
      await Promise.all(
        installments.map(async (installment) => {
          console.log(installment, 'installments');
          await this.prisma.installment.update({
            where: { id: installment.id },
            data: installment,
          });
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
      // Find all matching customers (not just first)
      const customers = await this.prisma.customer.findMany({
        where: {
          OR: [
            { ic: id },
            { passport: id },
            { name: { contains: id, mode: 'insensitive' } }
          ],
        },
      });
  
      if (!customers.length) {
        return [];
      }
  
      // Get all loans for all matching customers
      const customerIds = customers.map(c => c.id);
      const loans = await this.prisma.loan.findMany({
        where: { 
          customer_id: { in: customerIds } 
        },
        include: {
          installment: true,
          loan_share: true,
          user: true,
          customer: true
        },
      });
  
      return loans;
    } catch (error) {
      console.error('Error fetching loan status:', error);
      return [];
    }
  }
}
