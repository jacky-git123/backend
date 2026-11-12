import { Body, Controller, Param, Post, Put, UseGuards ,Get, Delete, Query, BadRequestException} from '@nestjs/common';
import { LoanService } from './loan.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { SessionAuthGuard } from 'src/session/session-auth.guard';
import { SessionUser } from 'src/session/session.dto';
import { CurrentUser } from 'src/session/current-user.decorator';

@Controller('loan')
@UseGuards(SessionAuthGuard) 
export class LoanController {
  constructor(private readonly loanService: LoanService) {}

  // Loan listing filtered by loan created date. Must stay above @Get(':id').
  // GET /loan/by-loan-date?fromDate=yyyy-MM-dd&toDate=yyyy-MM-dd&page=1&limit=10&filter=
  @Get('by-loan-date')
  async findAllByLoanDate(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('filter') filter: any,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @CurrentUser() user: SessionUser
  ) {
    // Accepts yyyy-MM-dd (what the frontend sends) or dd/MM/yyyy.
    // Builds the date at UTC midnight so it matches the DATE column exactly,
    // whatever the server's time zone is.
    const parseDate = (value: string, name: string): Date | undefined => {
      const text = (value ?? '').toString().trim();
      if (!text) return undefined;

      let year: number, month: number, day: number;
      const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      const dmyMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

      if (isoMatch) {
        [year, month, day] = [Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3])];
      } else if (dmyMatch) {
        [day, month, year] = [Number(dmyMatch[1]), Number(dmyMatch[2]), Number(dmyMatch[3])];
      } else {
        throw new BadRequestException(`${name} must be in yyyy-MM-dd format`);
      }

      const date = new Date(Date.UTC(year, month - 1, day));
      // Rejects dates like 2026-02-31 that JavaScript would roll over
      if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
      ) {
        throw new BadRequestException(`${name} is not a valid date`);
      }
      return date;
    };

    const from = parseDate(fromDate, 'fromDate');
    const to = parseDate(toDate, 'toDate');

    if (from && to && from > to) {
      throw new BadRequestException('fromDate cannot be after toDate');
    }

    return this.loanService.findAll(Number(page), Number(limit), filter, user.id, {
      fromDate: from,
      toDate: to,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    // @Query('userid') userid: any
    @CurrentUser() user: SessionUser
  ) {
    return this.loanService.findOne(id, user.id);
  }

  @Get()
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('filter') filter: any,
    // @Query('userid') userid: any
    @CurrentUser() user: SessionUser
  ) {
    
    return this.loanService.findAll(Number(page), Number(limit), filter, user.id);
  }

  // @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createLoanDto: CreateLoanDto, @CurrentUser() user: SessionUser) {
    if (createLoanDto.supervisor === '' && createLoanDto.supervisor_2 && createLoanDto.supervisor_2 !== '') {
      createLoanDto.supervisor = createLoanDto.supervisor_2;
      delete createLoanDto.supervisor_2;
    }
    return this.loanService.create(createLoanDto, user.id);
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
    @Body('limit') limit: number | undefined,
    @Body('status') status: string | undefined,
  ) {
    return this.loanService.getLoanChecksByAgent(agents, fromDate, toDate, userid, page, limit, status);
  }


}
