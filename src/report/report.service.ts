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
                    loanCreatedDate: loan.loan_date,
                    loanId: loan.generate_id,
                    agent: loan.user?.name || '',
                    customerName: loan.customer?.name || '',
                    customerIc: loan.customer?.ic || '',
                    loanAmount: 'RM' +parseFloat(loan.principal_amount).toFixed(2) || '0',
                    payableAmount: 'RM' +parseFloat(loan.payment_per_term).toFixed(2) || '0',
                    deposit: 'RM' +parseFloat(loan.deposit_amount).toFixed(2) || '0',
                    out:'RM' + (parseFloat(loan.principal_amount || '0') - parseFloat(loan.deposit_amount || '0')).toFixed(2),
                    dueDate: nextDueInstallment?.installment_date || '',
                    dueAmount: 'RM' + parseFloat(loan.payment_per_term).toFixed(2),
                    totalAmountReceived: 'RM' + parseFloat(totalAmountReceived).toFixed(2),
                    estimatedProfit: 'RM' +parseFloat(loan.estimated_profit).toFixed(2) || '0',
                    actualProfit: 'RM'+parseFloat(loan.actual_profit).toFixed(2) || '0'
                };
            });
    
            return formattedData;
        }
        if (report_type === 'payment') {
            const paymentData = await this.prisma.loan.findMany({
                where: {
                    loan_date: {
                        gte: new Date(loan_data_from).toISOString(),
                        lte: new Date(loan_data_to).toISOString(),
                    },
                    deleted: false,
                },
                include: {
                    customer: true,
                    payment: true,
                    
                },
                orderBy: {
                    loan_date: 'asc'
                }
            });
    
            const formattedData = paymentData.map(loan => {
                // Format date as dd-mm-yyyy
                const loanDate = new Date(loan.loan_date);
                const formattedDate = [
                    loanDate.getDate().toString().padStart(2, '0'),
                    (loanDate.getMonth() + 1).toString().padStart(2, '0'),
                    loanDate.getFullYear()
                ].join('-');
    
                // Calculate payment totals
                const paymentSummary = loan.payment.reduce((acc, payment) => {
                    if (payment.type === 'In') {
                        acc.totalIn += parseFloat(payment.amount || '0');
                    } else if (payment.type === 'Out') {
                        acc.totalOut += parseFloat(payment.amount || '0');
                    }
                    return acc;
                }, { totalIn: 0, totalOut: 0 });
    
                return {
                    loanCreatedDate: formattedDate,
                    loanId: loan.generate_id,
                    //agentName: loan.user?.name || '',
                    customerName: loan.customer?.name || '',
                    totalPaymentIn: paymentSummary.totalIn.toFixed(2),
                    totalPaymentOut: paymentSummary.totalOut.toFixed(2),
                   // bankAgentAccountNo: paymentSummary.account_details || ''
                };
            });
    
            return formattedData;
        }
        return [];
    }
}
