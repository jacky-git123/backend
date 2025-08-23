import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from 'src/user/user.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from './constants';
import { LocalStrategy } from './local.strategy';
import { JwtStrategy } from './jwt.strategy';
import { UserService } from 'src/user/user.service';
import { RunningNumberGenerator } from 'src/common/utils';
import { SessionService } from 'src/session/session.service';
import { SessionSerializer } from 'src/session/session-serializer.service';

@Module({
  imports: [
    UserModule,
    PassportModule.register({ session: true }),
    JwtModule.register({
      secret: 'your-secret-key',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  providers: [AuthService, UserService, LocalStrategy, JwtStrategy,RunningNumberGenerator, SessionService, SessionSerializer],
  controllers: [AuthController],
})
export class AuthModule {}
