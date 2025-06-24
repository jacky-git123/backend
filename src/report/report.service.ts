import { Injectable } from '@nestjs/common';
import { GenerateReportDto } from './dto/report.dto';
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
                    customerName: loan.customer?.name || '',
                    customerIc: loan.customer?.ic || '',
                    loanAmount: parseFloat(loan.principal_amount).toFixed(2) || '0',
                    payableAmount: parseFloat(loan.payment_per_term).toFixed(2) || '0',
                    deposit: parseFloat(loan.deposit_amount).toFixed(2) || '0',
                    out: (parseFloat(loan.principal_amount || '0') - parseFloat(loan.deposit_amount || '0')).toFixed(2),
                    dueDate: nextDueInstallment?.installment_date || '',
                    dueAmount:  parseFloat(loan.payment_per_term).toFixed(2),
                    totalAmountReceived:  parseFloat(totalAmountReceived).toFixed(2),
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
                    where: { id: payment.loan_id },
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

                return {
                    paymentType: payment.type,
                    paymntin_out: payment.payment_date,
                    agentName: loan.user?.name || '',
                    agentName2: loan.user_2?.name || '',
                    loanId: loan.generate_id,
                    customerName: loan.customer?.name || '',
                    amount: payment.amount,
                    bankAgentAccountNo: payment.account_details || '',
                    remarks: payment.remarks || '',
                };
            }));
            
    
            return formatPaymentData;
        }
        return [];
    }
}
