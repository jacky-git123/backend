import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { RunningNumberGenerator } from 'src/common/utils';

@Module({
	controllers: [CustomerController],
  providers: [CustomerService,RunningNumberGenerator],
})
export class CustomerModule {}
