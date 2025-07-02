import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { RunningNumberGenerator } from 'src/common/utils';
import { UserHierarchyService } from './user-hierarchy-service.service';

@Module({
  controllers: [UserController],
  providers: [UserService,RunningNumberGenerator, UserHierarchyService],
  exports: [UserService],
})
export class UserModule {}
