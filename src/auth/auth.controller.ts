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
    const response = await this.authService.login(req.user as SessionUser, req.sessionID);

    // Update session info after session is created
    response.sessionInfo.sessionId = req.sessionID;
    // Link session to user in background (don't wait for it)
    this.sessionService.linkSessionToUser(req.sessionID, req.user.id)
      .catch(error => console.error('Failed to link session to user:', error));
    
    return response;
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
}
