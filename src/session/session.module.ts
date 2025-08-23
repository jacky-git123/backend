import { Global, Module } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { PrismaSessionStore } from './prisma-session.store';
import { SessionService } from './session.service';
import { SessionSerializer } from './session-serializer.service';

@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: 'PRISMA_SESSION_STORE',
      useFactory: (prisma: PrismaService) => {
        return new PrismaSessionStore(prisma);
      },
      inject: [PrismaService],
    },
    PrismaSessionStore,
    SessionService,
    SessionSerializer,
  ],
  exports: ['PRISMA_SESSION_STORE', PrismaService],
})
export class SessionModule {}
