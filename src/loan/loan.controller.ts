import { Body, Controller, Param, Post, Put, UseGuards ,Get, Delete, Query} from '@nestjs/common';
import { LoanService } from './loan.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('loan')
export class LoanController {
  constructor(private readonly loanService: LoanService) {}

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Query('userid') userid: any
  ) {
    return this.loanService.findOne(id, userid);
  }

  @Get()
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('filter') filter: any,
    @Query('userid') userid: any
  ) {
    
    return this.loanService.findAll(Number(page), Number(limit), filter, userid);
  }

  // @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createLoanDto: CreateLoanDto) {
    if (createLoanDto.supervisor === '' && createLoanDto.supervisor_2 && createLoanDto.supervisor_2 !== '') {
      createLoanDto.supervisor = createLoanDto.supervisor_2;
      delete createLoanDto.supervisor_2;
    }
    return this.loanService.create(createLoanDto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateLoanDto: UpdateLoanDto) {
    return this.loanService.update(id, updateLoanDto);
  }
  
  @Put('installment/:id')
  updateInstallment(@Param('id') id: string, @Body() updateInstallment: any) {
    const authUserId = updateInstallment.userid;
    delete updateInstallment.userid;
    const arrayOfObjects = Object.entries(updateInstallment)
    .filter(([key]) => !isNaN(Number(key))) // keep only numeric keys
    .map(([, value]) => value);
    return this.loanService.updateInstallment(id, arrayOfObjects, authUserId);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.loanService.delete(id);
  }

  @Get('createInstallmentDates')
  createInstallmentDates() {
    return this.loanService.createInstallmentDates();
  }

  @Get('user-status/:searchTerm')
  async getLoanStatusByPassport(@Param('searchTerm') searchTerm: string) {
    return this.loanService.getLoanCountByGroups(searchTerm);
  }

  @Get('fixPayment/all')
  async fixPayment() {
    return this.loanService.fixPayment();
  }

  @Post('getLoanCheck')
  async getLoanCheck(
    @Body('agents') agents: string[] | undefined,
    @Body('fromDate') fromDate: string | undefined,
    @Body('toDate') toDate: string | undefined,
    @Body('userid') userid: string | undefined,
    @Body('page') page: number | undefined,
  ) {
    return this.loanService.getLoanChecksByAgent(agents, fromDate, toDate, userid, page);
  }


}
