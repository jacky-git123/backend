import { Controller, Post, Body, UseGuards, HttpStatus, HttpException } from '@nestjs/common';
import { ReportService } from './report.service';
import { SessionAuthGuard } from 'src/session/session-auth.guard';
import { GenerateAgentReportDto, GenerateReportDto, GetPaymentLoanDataDto, GetSalesReportDto } from './dto/report.dto';

@Controller('report')
@UseGuards(SessionAuthGuard) 
export class ReportController {
  constructor(
    private readonly reportService: ReportService, // Replace 'any' with the actual service type
  ) { }

  @Post()
  generateReport(@Body() generateReportDto: GenerateReportDto) {
    // This method will handle the logic for generating reports
    // You can call methods from the reportService to fetch data and format it as needed
    return this.reportService.generateReport(generateReportDto);
  }

  // @Post('agent-report')
  // generateAgentReport(@Body() generateAgentReportDto: GetPaymentLoanDataDto) {
  //   // This method will handle the logic for generating agent-specific reports
  //   // You can call methods from the reportService to fetch data and format it as needed
  //   return this.reportService.getPaymentLoanData(generateAgentReportDto);
  // }

  @Post('agent-report-summary')
  getPaymentLoanSummary(@Body() generateAgentReportDto: GetPaymentLoanDataDto) {
    // This method will handle the logic for generating agent-specific reports
    // You can call methods from the reportService to fetch data and format it as needed
    return this.reportService.getUserExpensesByMonth(generateAgentReportDto);
  }

  @Post('sales-report-summary')
  async getSalesReport(@Body() generateReportDto: GetSalesReportDto) {
    try {
      // Validate input
      if (!generateReportDto.agents || generateReportDto.agents.length === 0) {
        throw new HttpException('Agents array is required and cannot be empty', HttpStatus.BAD_REQUEST);
      }

      if (!generateReportDto.fromDate || !generateReportDto.toDate) {
        throw new HttpException('Both fromDate and toDate are required', HttpStatus.BAD_REQUEST);
      }

      const fromDate = new Date(generateReportDto.fromDate);
      const toDate = new Date(generateReportDto.toDate);

      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        throw new HttpException('Invalid date format', HttpStatus.BAD_REQUEST);
      }

      if (fromDate > toDate) {
        throw new HttpException('fromDate cannot be greater than toDate', HttpStatus.BAD_REQUEST);
      }

      return await this.reportService.getSalesReport(generateReportDto);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
