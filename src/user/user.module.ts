import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { RunningNumberGenerator } from 'src/common/utils';
import { UserHierarchyService } from './user-hierarchy-service.service';
import { SessionService } from 'src/session/session.service';
import { SessionSerializer } from 'src/session/session-serializer.service';
import { SessionAuthGuard } from 'src/session/session-auth.guard';

@Module({
  controllers: [UserController],
  providers: [UserService,RunningNumberGenerator, UserHierarchyService, SessionAuthGuard, SessionSerializer, SessionService],
  exports: [UserService],
})
export class UserModule {}
