import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, Headers } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CreateCustomerDto, UpdateCustomerDto } from './customer.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { LocalAuthGuard } from 'src/auth/local-auth.guard';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('customer')
export class CustomerController {
    constructor(private readonly customerService: CustomerService) {}

  // @UseGuards(AuthGuard)
  @Post()
  async create(@Body() createCustomerDto: CreateCustomerDto, @Headers() headers: any) {
    console.log(headers);
    if (headers.auth_user) {
      createCustomerDto.created_by = headers.user_id;
    }
    return this.customerService.create(createCustomerDto);
  }

  @Get()
  async findAll(
    @Query('skip') skip: number = 0,
    @Query('take') take: number = 10,
    @Query('filter') filter: any
  ) {
    return this.customerService.findAll(Number(skip), Number(take), filter);
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
