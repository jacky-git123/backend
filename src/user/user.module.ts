import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { RunningNumberGenerator } from 'src/common/utils';

@Module({
  controllers: [UserController],
  providers: [UserService,RunningNumberGenerator],
  exports: [UserService],
})
export class UserModule {}
