import { Injectable } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';

@Injectable()
export class SessionService {
  // This service can be used to manage session-related logic
  // For example, you can add methods to create, update, or delete sessions
  // as needed in your application.
  constructor(private prisma: PrismaService) { }

  // Get all active sessions for a user
  async getUserActiveSessions(userId: string) {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return sessions.map(session => ({
      sessionId: session.sid,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      data: session.data,
    }));
  }

  // Get session details by session ID
  async getSessionById(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { sid: sessionId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    return {
      sessionId: session.sid,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      user: session.user,
      data: session.data,
    };
  }

  // Revoke a specific session
  async revokeSession(sessionId: string) {
    await this.prisma.session.delete({
      where: { sid: sessionId },
    });
    return { message: 'Session revoked successfully' };
  }

  // Revoke all sessions for a user except current
  async revokeUserSessionsExceptCurrent(userId: string, currentSessionId: string) {
    const result = await this.prisma.session.deleteMany({
      where: {
        userId,
        sid: {
          not: currentSessionId,
        },
      },
    });

    return {
      message: `Revoked ${result.count} sessions`,
      revokedCount: result.count,
    };
  }

  // Revoke all sessions for a user
  async revokeAllUserSessions(userId: string) {
    const result = await this.prisma.session.deleteMany({
      where: { userId },
    });

    return {
      message: `Revoked all ${result.count} sessions for user`,
      revokedCount: result.count,
    };
  }

  // Clean up expired sessions
  async cleanupExpiredSessions() {
    const result = await this.prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return {
      message: `Cleaned up ${result.count} expired sessions`,
      cleanedCount: result.count,
    };
  }

  // Get comprehensive session statistics
  async getSessionStats() {
    const [
      totalSessions,
      activeSessions,
      expiredSessions,
      sessionsByUser,
      recentSessions,
    ] = await Promise.all([
      this.prisma.session.count(),
      this.prisma.session.count({
        where: {
          expiresAt: { gt: new Date() },
        },
      }),
      this.prisma.session.count({
        where: {
          expiresAt: { lt: new Date() },
        },
      }),
      this.prisma.session.groupBy({
        by: ['userId'],
        where: {
          expiresAt: { gt: new Date() },
          userId: { not: null },
        },
        _count: { sid: true },
      }),
      this.prisma.session.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        where: {
          expiresAt: { gt: new Date() },
        },
        include: {
          user: {
            select: { email: true, name: true },
          },
        },
      }),
    ]);

    return {
      totalSessions,
      activeSessions,
      expiredSessions,
      uniqueActiveUsers: sessionsByUser.length,
      averageSessionsPerUser: sessionsByUser.length > 0
        ? sessionsByUser.reduce((sum, group) => sum + group._count.sid, 0) / sessionsByUser.length
        : 0,
      recentSessions: recentSessions.map(session => ({
        sessionId: session.sid,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        user: session.user,
      })),
    };
  }

  // Update user's session info after login
  async updateUserLoginInfo(userId: string, sessionId?: string) {
    const updateData: any = {
      last_login: new Date(),
      session_count: {
        increment: 1,
      },
    };

    await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // Link session if sessionId is provided
    if (sessionId) {
      await this.linkSessionToUser(sessionId, userId);
    }
  }

  // Get user login history (if you want to track this)
  async getUserLoginHistory(userId: string, limit: number = 10) {
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return sessions.map(session => ({
      sessionId: session.sid,
      loginTime: session.createdAt,
      lastActivity: session.updatedAt,
      expiresAt: session.expiresAt,
      isActive: session.expiresAt > new Date(),
    }));
  }

  async linkSessionToUser(sessionId: string, userId: string) {
    try {
      await this.prisma.session.update({
        where: { sid: sessionId },
        data: { userId },
      });
    } catch (error) {
      console.error('Session linking failed:', error);
    }
  }

}
