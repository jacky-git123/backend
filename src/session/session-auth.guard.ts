import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SessionService } from 'src/session/session.service';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Check if user is authenticated via session
    if (!request.isAuthenticated || !request.isAuthenticated()) {
      throw new UnauthorizedException('Not authenticated');
    }

    // Check if user exists in request (populated by passport session)
    if (!request.user || !request.user.id) {
      throw new UnauthorizedException('Invalid session - no user found');
    }

    // Optional: Verify session exists in database
    try {
      if (request.sessionID) {
        const sessionData = await this.sessionService.getSessionById(request.sessionID);
        
        // Check if session is expired
        if (sessionData.expiresAt < new Date()) {
          throw new UnauthorizedException('Session expired');
        }

        // Check if session belongs to the authenticated user
        if (sessionData.user && sessionData.user.id !== request.user.id) {
          throw new UnauthorizedException('Session user mismatch');
        }
      }
    } catch (error) {
      // If session not found in database, still allow if passport session is valid
      // This handles edge cases where session might be cleaned up but passport session still exists
      console.warn('Session verification warning:', error.message);
    }

    return true;
  }
}