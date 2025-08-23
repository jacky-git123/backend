import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { ChangePasswordDto } from '../user/dto/change-password.dto';
import * as bcrypt from 'bcrypt';
import { LoginResponse, SessionUser } from 'src/session/session.dto';
import { SessionService } from 'src/session/session.service';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private sessionService: SessionService,
  ) { }

  async validateUser(email: string, password: string): Promise<any> {
    return this.userService.validateUser(email, password).catch((err) => {
      console.log('User validation error:', err);
      throw new BadRequestException(err.message);
    });
  }

  async login(user: SessionUser, sessionId: string): Promise<LoginResponse> {
    console.log('AuthService.login called with:', { userId: user.id, sessionId });

    try {
      // Update user's login info (this will handle single device login)
      await this.sessionService.updateUserLoginInfo(user.id, sessionId, true); // true = single device

      // Try to get session data, with fallback
      let sessionData;
      try {
        sessionData = await this.sessionService.getSessionById(sessionId);
      } catch (error) {
        console.log('Could not fetch session data, creating default response');
        sessionData = {
          sessionId,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
          createdAt: new Date(),
          updatedAt: new Date(),
          user: null,
          data: {},
        };
      }

      const response = {
        message: 'Login successful',
        user,
        sessionInfo: {
          sessionId,
          expiresAt: sessionData.expiresAt,
          createdAt: sessionData.createdAt,
        },
      };

      console.log('Login response prepared:', response);
      return response;
    } catch (error) {
      console.error('Login service error:', error);
      throw new BadRequestException('Login failed: ' + error.message);
    }
  }
  
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<void> {
    const { currentPassword, newPassword } = changePasswordDto;
    const user = await this.userService.findOne(userId);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await this.userService.updatePassword(userId, hashedNewPassword);

    // After password change, revoke all sessions to force re-login
    try {
      await this.sessionService.revokeAllUserSessions(userId);
      console.log('All sessions revoked after password change for user:', userId);
    } catch (error) {
      console.error('Failed to revoke sessions after password change:', error);
      // Don't fail the password change if session cleanup fails
    }
  }
}