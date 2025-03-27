import { Body, Controller, Post, UseGuards, Request, Put, Headers } from '@nestjs/common';
import { LocalAuthGuard } from './local-auth.guard';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ChangePasswordDto } from '../user/dto/change-password.dto';
import { AuthGuard } from './auth.guard';

@Controller('auth')
export class AuthController {
constructor(private authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @UseGuards(AuthGuard)
  @Put('change-password')
  async changePassword(@Headers() headers, @Body() changePasswordDto: ChangePasswordDto) {
    await this.authService.changePassword(headers.auth_user.sub, changePasswordDto);
    return { message: 'Password changed successfully' };
  }
}
