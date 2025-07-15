import { Injectable } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { connect } from 'http2';
import { RunningNumberGenerator } from 'src/common/utils';
import { LoanService } from 'src/loan/loan.service';
import { format } from 'date-fns';

@Injectable()
export class PaymentService {
    constructor(private prisma: PrismaService,
      private utilService:RunningNumberGenerator,
      private loanService: LoanService
    ) {}

  async createOrUpdate(paymentDto: any) {
    // Extract payment objects from numbered keys (0, 1, etc.)
    const payments = Object.entries(paymentDto)
      .filter(([key]) => !isNaN(Number(key)))
      .map(([, value]) => value as any);

    const loan_id = paymentDto[0].loan_id;
    // Get userid if present
    const userid = paymentDto.userid;

    const results = [];

    for (const payment of payments) {

      // update loan status to completed if balance is less then 0 
      const balance = Number(payment.balance);
      if (!isNaN(balance) && balance <= 0) {
        await this.prisma.loan.update({
          where:  { id: payment.loan_id },
          data:   { status: 'Completed' }     
        });
      }

      // Check if payment already exists (has generate_id)
      if (payment.generate_id) {
        // Check if this generate_id already exists in the database
        const existingPayment = await this.prisma.payment.findFirst({
          where: { generate_id: payment.generate_id }
        });

        if (existingPayment) {
          // Update existing payment
          const updatedPayment = await this.updatePayment(payment, userid);
          results.push(updatedPayment);
        } else {
          // Create new payment with provided generate_id
          const newPayment = await this.createPayment(payment, userid);
          results.push(newPayment);
        }
      } else {
        // Create new payment
        const newPayment = await this.createPayment(payment, userid);
        results.push(newPayment);
      }
    }

    const paymentData = await this.prisma.payment.findMany({
      where: { loan_id: loan_id }
    });

    const outPayment = paymentData.find(entry => entry.type === 'Out');
    const outAmount = outPayment ? parseFloat(outPayment.amount) : 0;

    // Sum all "In" amounts
    const totalInAmount = paymentData
    .filter(entry => entry.type === 'In')
    .reduce((sum, entry) => sum + parseFloat(entry.amount), 0);

    // Calculate the difference
    const remainingAmount =totalInAmount- outAmount;

    const updateActualProfit = await this.loanService.updateLoanProfit(String(loan_id), String(remainingAmount));

    return results;
  }

  private async createPayment(payment: any, userId?: string) {
    // Generate unique ID if not already present
    if (!payment.generate_id) {
      payment.generate_id = await this.utilService.generateUniqueNumber('PM');
    }

    // Validate installment if specified
    if (payment.installment_id) {
      const _installment = await this.prisma.installment.findFirst({
        where: { id: payment.installment_id },
      });

      if (!_installment) {
        throw new Error(`Installment with id ${payment.installment_id} not found`);
      }
    }
      payment.payment_date = format(payment.payment_date, 'yyyy-MM-dd');
    // Prepare data for creation
    const paymentData: any = {
      generate_id: payment.generate_id,
      type: payment.type || 'In',
      payment_date: new Date(payment.payment_date + 'T00:00:00Z'),
      installment_date: payment.installment_date,
      amount: payment.amount,
      balance: payment.balance,
      account_details: payment.account_details,
      remarks:payment.remarks,
      // status: payment.status || 'Paid',
      // receiving_date: payment.receiving_date,
      created_by: userId,
    };

    // Connect to loan if specified
    if (payment.loan_id) {
      paymentData.loan = {
        connect: {
          id: payment.loan_id,
        }
      };
    }

    // Connect to installment if specified
    if (payment.installment_id) {
      paymentData.installment = {
        connect: {
          id: payment.installment_id,
        },
      };
    }

    // Create payment record
    const createdPayment = await this.prisma.payment.create({
      data: paymentData,
    });

    return createdPayment;
  }

  private async updatePayment(payment: any, userId?: string) {
    // Validate installment if specified
    // if (payment.installment_id) {
    //   const _installment = await this.prisma.installment.findFirst({
    //     where: { id: payment.installment_id },
    //   });

    //   if (!_installment) {
    //     throw new Error(`Installment with id ${payment.installment_id} not found`);
    //   }
    // }
    payment.payment_date = format(payment.payment_date, 'yyyy-MM-dd');
    // Find the existing payment by generate_id
    const existingPayment = await this.prisma.payment.findFirst({
      where: { generate_id: payment.generate_id }
    });

    if (!existingPayment) {
      throw new Error(`Payment with generate_id ${payment.generate_id} not found`);
    }

    // Prepare data for update
    const paymentData: any = {
      type: payment.type,
      payment_date: new Date(payment.payment_date + 'T00:00:00Z'),
      installment_date: payment.installment_date,
      amount: payment.amount,
      balance: payment.balance,
      account_details: payment.account_details,
      remarks:payment.remarks,
      // status: payment.status,
      // receiving_date: payment.receiving_date,
      updated_by: userId,
      updated_at: new Date(),
    };

    // Only include fields that are provided
    Object.keys(paymentData).forEach(key =>
      paymentData[key] === undefined && delete paymentData[key]
    );

    // Update loan connection if specified
    if (payment.loan_id) {
      paymentData.loan = {
        connect: {
          id: payment.loan_id,
        }
      };
    }

    // Update installment connection if specified
    if (payment.installment_id) {
      paymentData.installment = {
        connect: {
          id: payment.installment_id,
        },
      };
    } else if (payment.installment_id === null) {
      // Disconnect installment if explicitly set to null
      paymentData.installment = {
        disconnect: true
      };
    }

    // Update payment record using the id from the found record
    const updatedPayment = await this.prisma.payment.update({
      where: { id: existingPayment.id },
      data: paymentData,
    });

    // After updating payment, check all payments related to the same loan
    if (payment.loan_id) {
      // Find all payments for this loan
      const allPayments = await this.prisma.payment.findMany({
      where: { loan_id: payment.loan_id }
      });

      // Sum all "In" payments
      const totalIn = allPayments
      .filter(p => p.type === 'In')
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);

      // Get the loan details
      const loan = await this.prisma.loan.findUnique({
      where: { id: payment.loan_id }
      });

      if (loan) {
      // If total "In" payments >= payable_amount, set status to Completed
      // if (totalIn >= parseFloat(loan.principal_amount)) {
      //   await this.prisma.loan.update({
      //   where: { id: payment.loan_id },
      //   data: { status: 'Completed' }
      //   });
      // }

      // Check for overdue unpaid installments
      const overdueInstallments = await this.prisma.installment.findMany({
        where: {
        loan_id: payment.loan_id,
        status: 'Unpaid',
        receiving_date: {
          lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) // more than 14 days ago
        }
        }
      });

      if (overdueInstallments.length > 0) {
        await this.prisma.loan.update({
        where: { id: payment.loan_id },
        data: { status: 'Bad Debt' }
        });
      }
      }
    }

    return updatedPayment;
  }

  async findAll() {
    return this.prisma.payment.findMany();
  }

  async findOne(id: string) {
    return this.prisma.payment.findUnique({
      where: { id },
    });
  }

  async getByLoanId(id: string) {
    return this.prisma.payment.findMany({
      include: { installment: true },
      where: {
        loan_id: id,
      },
    });
  }

  async update(id: string, updatePaymentDto: UpdatePaymentDto) {
    return this.prisma.payment.update({
      where: { id },
      data: updatePaymentDto,
    });
  }

  async remove(id: string) {
    return this.prisma.payment.delete({
      where: { id },
    });
  }
}
