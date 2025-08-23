import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';
import { PrismaService } from 'nestjs-prisma';
import { SessionUser } from './session.dto';

@Injectable()
export class SessionSerializer extends PassportSerializer {
  constructor(private prisma: PrismaService) {
    super();
  }

  serializeUser(user: SessionUser, done: (err: Error, user: SessionUser) => void): any {
    done(null, user);
  }

  async deserializeUser(user: SessionUser, done: (err: Error, user: SessionUser | null) => void) {
    try {
      // Always verify user status from database
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          role: true,
          name: true,
          status: true,
          deleted: true,
        },
      });

      if (!dbUser || dbUser.deleted || !dbUser.status) {
        return done(null, null);
      }

      done(null, {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        name: dbUser.name,
        sessionStartTime: user.sessionStartTime,
      });
    } catch (error) {
      done(error, null);
    }
  }
}