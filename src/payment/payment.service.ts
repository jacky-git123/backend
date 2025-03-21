import { Injectable } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { connect } from 'http2';
import { RunningNumberGenerator } from 'src/common/utils';

@Injectable()
export class PaymentService {
    constructor(private prisma: PrismaService,
      private utilService:RunningNumberGenerator
    ) {}

  async create(createPaymentDto: any) {
    const createdPayments = [];
    for (let i = 0; i < createPaymentDto.length; i++) {
      const generate_id = await this.utilService.generateUniqueNumber('PM');
      const payment = createPaymentDto[i];
      payment['generate_id']=generate_id;
      if (payment.installment_id) {
        const _installment = await this.prisma.installment.findFirst({
          where: { id: payment.installment_id },
        });
        if (!_installment) {
          throw new Error(`installment with id ${payment.installment_id} not found`);
        }
      }
      const newData: any = {
        generate_id:payment.generate_id,
        type: payment.type || 'in',
        payment_date: payment.payment_date,
        amount: payment.amount,
        balance: payment.balance,
        account_details: payment.account_details,
        loan: {
          connect: {
            id: payment.loan_id,
          }
        }
      };
      if (payment.installment_id) {
        newData.installment = {
          connect: {
            id: payment.installment_id,
          },
        };
      }
      const createdPayment = await this.prisma.payment.create({
        data: newData,
      });
      createdPayments.push(createdPayment);
    }
    return createdPayments;
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
