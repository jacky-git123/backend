import { Controller, Post, Body } from '@nestjs/common';
import { ReportService } from './report.service';
import { GenerateReportDto } from './dto/report.dto';

@Controller('report')
export class ReportController {
    constructor(
        private readonly reportService: ReportService, // Replace 'any' with the actual service type
    ) {}

    @Post()
    generateReport(@Body() generateReportDto: GenerateReportDto) {
        // This method will handle the logic for generating reports
        // You can call methods from the reportService to fetch data and format it as needed
        return this.reportService.generateReport(generateReportDto);
    }
}
