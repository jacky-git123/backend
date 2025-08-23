import { Store } from 'express-session';
import { PrismaService } from 'nestjs-prisma';
import { Injectable } from '@nestjs/common';

interface SessionData {
  cookie: any;
  [key: string]: any;
}

@Injectable()
export class PrismaSessionStore extends Store {
  constructor(private prisma: PrismaService,) {
    super();
    this.prisma = prisma;
  }

  // Get session by session ID
  async get(sid: string, callback: (err?: any, session?: SessionData | null) => void) {
    try {
      const session = await this.prisma.session.findUnique({
        where: { sid },
      });

      if (!session) {
        return callback(null, null);
      }

      // Check if session has expired
      if (session.expiresAt < new Date()) {
        await this.destroy(sid, () => {});
        return callback(null, null);
      }

      callback(null, session.data as SessionData);
    } catch (error) {
      callback(error);
    }
  }

  // Save/update session
  async set(sid: string, session: SessionData, callback?: (err?: any) => void) {
    try {
      const expiresAt = session.cookie?.expires || new Date(Date.now() + 5 * 60 * 1000);
      const userId = session.passport?.user?.id || null;

      await this.prisma.session.upsert({
        where: { sid },
        update: {
          data: session as any,
          expiresAt,
          userId,
          updatedAt: new Date(),
        },
        create: {
          sid,
          data: session as any,
          expiresAt,
          userId,
        },
      });

      callback && callback();
    } catch (error) {
      callback && callback(error);
    }
  }

  // Destroy session
  async destroy(sid: string, callback?: (err?: any) => void) {
    try {
      await this.prisma.session.delete({
        where: { sid },
      });
      callback && callback();
    } catch (error) {
      // If session doesn't exist, that's fine
      callback && callback();
    }
  }

  // Touch session (update expiry)
  async touch(sid: string, session: SessionData, callback?: (err?: any) => void) {
    try {
      const expiresAt = session.cookie?.expires || new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      await this.prisma.session.update({
        where: { sid },
        data: {
          expiresAt,
          updatedAt: new Date(),
        },
      });
      
      callback && callback();
    } catch (error) {
      callback && callback(error);
    }
  }

  // Get all session IDs
  async all(callback: (err?: any, obj?: SessionData[] | null) => void) {
    try {
      const sessions = await this.prisma.session.findMany({
        where: {
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      const sessionData = sessions.map(session => session.data as SessionData);
      callback(null, sessionData);
    } catch (error) {
      callback(error);
    }
  }

  // Get session count
  async length(callback: (err?: any, length?: number) => void) {
    try {
      const count = await this.prisma.session.count({
        where: {
          expiresAt: {
            gt: new Date(),
          },
        },
      });
      callback(null, count);
    } catch (error) {
      callback(error);
    }
  }

  // Clear all sessions
  async clear(callback?: (err?: any) => void) {
    try {
      await this.prisma.session.deleteMany({});
      callback && callback();
    } catch (error) {
      callback && callback(error);
    }
  }
}