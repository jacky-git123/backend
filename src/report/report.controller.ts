import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ReportService } from './report.service';
import { SessionAuthGuard } from 'src/session/session-auth.guard';
import { GenerateAgentReportDto, GenerateReportDto, GetPaymentLoanDataDto } from './dto/report.dto';

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

  @Post('agent-performance')
  async getAgentPerformance(@Body() dto: GetPaymentLoanDataDto) {
    return this.reportService.getAgentSalesReport(
      dto.agents,
      new Date(dto.fromDate),
      new Date(dto.toDate),
    );
  }
}
