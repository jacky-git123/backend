import { Body, Controller, Post, UseGuards, Request, Put, Headers, Query, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from '../user/dto/change-password.dto';
import { AuthGuard } from '@nestjs/passport';
import { LoginResponse, SessionUser } from 'src/session/session.dto';
import { SessionService } from 'src/session/session.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private sessionService: SessionService,
  ) {}

  @Post('login')
  @UseGuards(AuthGuard('local'))
  async login(@Req() req: any): Promise<LoginResponse> {
    console.log('Login attempt - Session ID:', req.sessionID);
    console.log('Login attempt - User:', req.user);

    try {
      // STEP 1: Revoke all existing sessions for this user (single device login)
      console.log('Revoking existing sessions for user:', req.user.id);
      await this.sessionService.revokeAllUserSessions(req.user.id);

      // STEP 2: Ensure user is logged in to the current session
      await new Promise<void>((resolve, reject) => {
        req.logIn(req.user, (err) => {
          if (err) {
            console.error('Session login error:', err);
            reject(err);
          } else {
            console.log('User logged into session successfully');
            resolve();
          }
        });
      });

      // STEP 3: Wait a moment for express-session to save the session
      await new Promise(resolve => setTimeout(resolve, 100));

      // STEP 4: Get the login response
      const response = await this.authService.login(req.user as SessionUser, req.sessionID);

      // STEP 5: Update session info
      response.sessionInfo.sessionId = req.sessionID;
      
      // STEP 6: Ensure session is linked to user with retry logic
      setTimeout(async () => {
        try {
          await this.sessionService.ensureSessionAndLinkToUser(req.sessionID, req.user.id);
        } catch (error) {
          console.error('Failed to link session to user (background task):', error);
        }
      }, 200); // Run in background after response is sent
      
      console.log('Login successful, returning response:', response);
      return response;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  @Put('change-password')
  async changePassword(@Headers() headers, @Body() changePasswordDto: ChangePasswordDto) {
    await this.authService.changePassword(changePasswordDto.userid, changePasswordDto);
    return { message: 'Password changed successfully' };
  }

  @Post('logout')
  async logout(@Req() req: any) {
    return new Promise((resolve, reject) => {
      const sessionId = req.sessionID;
      const userId = req.user?.id;

      req.logout((err) => {
        if (err) {
          console.error('Logout error:', err);
          return reject(err);
        }
        
        req.session.destroy(async (err) => {
          if (err) {
            console.error('Session destroy error:', err);
            return reject(err);
          }

          // Clean up session from database if it exists
          if (sessionId) {
            try {
              await this.sessionService.revokeSession(sessionId);
              console.log('Session cleaned up from database:', sessionId);
            } catch (error) {
              console.error('Failed to clean up session from database:', error);
              // Don't fail logout if database cleanup fails
            }
          }

          resolve({ message: 'Logged out successfully' });
        });
      });
    });
  }

  // Optional: Endpoint to get current session info
  @Post('session-info')
  async getSessionInfo(@Req() req: any) {
    if (!req.user) {
      return { authenticated: false };
    }

    try {
      const sessionData = await this.sessionService.getSessionById(req.sessionID);
      return {
        authenticated: true,
        user: req.user,
        session: sessionData,
      };
    } catch (error) {
      return {
        authenticated: true,
        user: req.user,
        sessionId: req.sessionID,
        error: 'Could not fetch session details',
      };
    }
  }
}