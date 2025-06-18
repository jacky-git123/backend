import { Injectable } from '@nestjs/common';
import { GenerateReportDto } from './dto/report.dto';
import { PrismaService } from 'nestjs-prisma';

@Injectable()
export class ReportService {
    constructor(private prisma: PrismaService,
      ) { }
    // This service will handle the logic for generating reports
    // You can inject other services here to fetch data and format it as needed
    
    generateReport(generateReportDto: GenerateReportDto) {
        // Logic to generate a report
        // This could involve fetching data from a database, formatting it, etc.
        const { loan_data_from, loan_data_to, report_type } = generateReportDto;
        if (report_type === 'loan') {
            const loanData = this.prisma.loan.findMany({
                where: {
                    // loan_date: {
                    //     gte: new Date(loan_data_from),
                    //     lte: new Date(loan_data_to),
                    // },
                },
                include: {
                    customer: true, // Include related customer data
                    installment: true, // Include related installments if needed
                },
            });
        }
        return generateReportDto;
    }
}
