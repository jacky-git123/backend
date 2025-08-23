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
      console.log('err', err);
      throw new BadRequestException(err.message);
    });
  }

  async login(user: SessionUser, sessionId: string): Promise<LoginResponse> {
    // Update user's login info and link session
    await this.sessionService.updateUserLoginInfo(user.id, sessionId);

    const sessionData = await this.sessionService.getSessionById(sessionId);

    return {
      message: 'Login successful',
      user,
      sessionInfo: {
        sessionId,
        expiresAt: sessionData.expiresAt,
        createdAt: sessionData.createdAt,
      },
    };
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
  }
}
