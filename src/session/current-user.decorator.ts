import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SessionUser } from 'src/session/session.dto';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext): SessionUser => {
    const request = ctx.switchToHttp().getRequest();
    
    if (!request.user) {
      return null;
    }

    // If a specific property is requested, return that property
    if (data) {
      return request.user[data];
    }

    // Return the full user object
    return request.user;
  },
);