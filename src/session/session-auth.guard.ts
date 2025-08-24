import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SessionService } from 'src/session/session.service';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Check if user is authenticated via session
    if (!request.isAuthenticated || !request.isAuthenticated()) {
      console.log('User not authenticated');
      throw new UnauthorizedException('Not authenticated');
    }

    // Check if user exists in request (populated by passport session)
    if (!request.user || !request.user.id) {
      console.log('No user found in session');
      throw new UnauthorizedException('Invalid session - no user found');
    }

    try {
      if (request.sessionID) {
        const sessionData = await this.sessionService.getSessionById(request.sessionID);
        // Check if session is expired
        if (sessionData.expiresAt < new Date()) {
          console.log('Session expired');
          throw new UnauthorizedException('Session expired');
        }
        // Refresh session activity - this extends the session expiry
        await this.sessionService.refreshSessionActivity(request.sessionID, request.user.id);
        
        // Optional: Add last activity timestamp to user object
        request.user.lastActivity = new Date();
        
        console.log(`Session refreshed for user ${request.user.id} - ${request.method} ${request.url}`);
      }
    } catch (error) {
      console.error('Session refresh error:', error);
      // If session refresh fails, check if session is still valid
      try {
        if (request.sessionID) {
          const sessionData = await this.sessionService.getSessionById(request.sessionID);
          
          // Check if session is expired
          if (sessionData.expiresAt < new Date()) {
            throw new UnauthorizedException('Session expired');
          }
        }
      } catch (sessionError) {
        console.error('Session validation failed:', sessionError);
        throw new UnauthorizedException('Session validation failed');
      }

    }

    return true;
  }
}