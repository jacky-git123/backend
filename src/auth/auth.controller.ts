import { Body, Controller, Post, UseGuards, Request, Put, Headers, Query, Req } from '@nestjs/common';
// import { LocalAuthGuard } from './local-auth.guard';
import { AuthService } from './auth.service';
// import { JwtAuthGuard } from './jwt-auth.guard';
import { ChangePasswordDto } from '../user/dto/change-password.dto';
// import { AuthGuard } from './auth.guard';
import { AuthGuard } from '@nestjs/passport';
import { LoginResponse, SessionUser } from 'src/session/session.dto';
import { SessionService } from 'src/session/session.service';

@Controller('auth')
export class AuthController {
constructor(private authService: AuthService,
  private sessionService: SessionService,
) {}

  @Post('login')
  @UseGuards(AuthGuard('local'))
  async login(@Req() req: any): Promise<LoginResponse> {
    console.log('Login attempt - Session ID:', req.sessionID);
    console.log('Login attempt - User:', req.user);

    try {
      // Ensure user is logged in to the session
      req.logIn(req.user, (err) => {
        if (err) {
          console.error('Session login error:', err);
        } else {
          console.log('User logged into session successfully');
        }
      });

      const response = await this.authService.login(req.user as SessionUser, req.sessionID);

      // Update session info after session is created
      response.sessionInfo.sessionId = req.sessionID;
      
      // Link session to user in background (don't wait for it)
      await this.sessionService.linkSessionToUser(req.sessionID, req.user.id)
        .catch(error => console.error('Failed to link session to user:', error));
      
      console.log('Login successful, returning response:', response);
      return response;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // @UseGuards(LocalAuthGuard)
  // @Post('login')
  // async login(@Request() req) {
  //   return this.authService.login(req.user);
  // }

  // @UseGuards(AuthGuard)
  @Put('change-password')
  async changePassword(@Headers() headers, @Body() changePasswordDto: ChangePasswordDto) {
    await this.authService.changePassword(changePasswordDto.userid, changePasswordDto);
    return { message: 'Password changed successfully' };
  }

  @Post('logout')
  async logout(@Req() req: any) {
    return new Promise((resolve, reject) => {
      req.logout((err) => {
        if (err) {
          console.error('Logout error:', err);
          return reject(err);
        }
        
        req.session.destroy((err) => {
          if (err) {
            console.error('Session destroy error:', err);
            return reject(err);
          }
          resolve({ message: 'Logged out successfully' });
        });
      });
    });
  }
}
