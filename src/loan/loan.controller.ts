import { Body, Controller, Param, Post, Put, UseGuards ,Get, Delete, Query} from '@nestjs/common';
import { LoanService } from './loan.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('loan')
export class LoanController {
  constructor(private readonly loanService: LoanService) {}

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.loanService.findOne(id);
  }

  @Get()
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('filter') filter: any
  ) {
    return this.loanService.findAll(Number(page), Number(limit), filter);
  }

  // @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createLoanDto: CreateLoanDto) {
    return this.loanService.create(createLoanDto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateLoanDto: UpdateLoanDto) {
    return this.loanService.update(id, updateLoanDto);
  }
  
  @Put('installment/:id')
  updateInstallment(@Param('id') id: string, @Body() updateInstallment: any) {
    return this.loanService.updateInstallment(id, updateInstallment);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.loanService.delete(id);
  }

  @Get('createInstallmentDates')
  createInstallmentDates() {
    return this.loanService.createInstallmentDates();
  }

  @Get('user-status/:passportNumber')
  async getLoanStatusByPassport(@Param('passportNumber') passportNumber: string) {
    return this.loanService.getLoanStatusByPassport(passportNumber);
  }


}
