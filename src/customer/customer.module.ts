import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { RunningNumberGenerator } from 'src/common/utils';
import { UserHierarchyService } from 'src/user/user-hierarchy-service.service';
import { SessionService } from 'src/session/session.service';

@Module({
	controllers: [CustomerController],
  providers: [CustomerService,RunningNumberGenerator, UserHierarchyService, SessionService],
})
export class CustomerModule {}
