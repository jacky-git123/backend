import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, Headers } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CreateCustomerDto, UpdateCustomerDto } from './customer.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { LocalAuthGuard } from 'src/auth/local-auth.guard';
import { AuthGuard } from 'src/auth/auth.guard';
import { UserHierarchyService } from 'src/user/user-hierarchy-service.service';

@Controller('customer')
export class CustomerController {
    constructor(
      private readonly customerService: CustomerService,
      private readonly userHierarchyService:UserHierarchyService
    ) {}

  // @UseGuards(AuthGuard)
  @Post()
  async create(@Body() createCustomerDto: CreateCustomerDto, @Headers() headers: any) {

    if (headers.auth_user) {
      createCustomerDto.created_by = headers.user_id;
      createCustomerDto.updated_by = headers.user_id;
    }else {
      createCustomerDto.created_by = createCustomerDto.userid;
      createCustomerDto.updated_by = createCustomerDto.userid;
    }
    return this.customerService.create(createCustomerDto);
  }

  @Get()
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('filter') filter: any,
    @Query('userid') userid: any,
  ) {
    const authUserId = userid;

    const skip = (page - 1) * limit;
    return this.customerService.findAll(Number(skip), Number(limit), filter, authUserId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.customerService.findOne(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateCustomerDto: UpdateCustomerDto) {
    return this.customerService.update(id, updateCustomerDto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.customerService.delete(id);
  }

  @Post('add-document')
  addDocument(@Body() data: { id: string; filesData: any[] }) {
    return this.customerService.addDocument(data);
  }

  @Get('getDocument/:key')
  async getDocument(@Param('key') key: string) {
    return this.customerService.getDocument(key);
  }

  
  @Get('getCustomer/:key')
  async getCustomer(@Param('key') key: string) {
    return this.customerService.getCustomer(key);
  }

  @Post('get-customer-status')
  getCustomerStatus(
    @Body() data: { key: string }
  ) {
    return this.customerService.getCustomerStatus(data.key);
  }
}
