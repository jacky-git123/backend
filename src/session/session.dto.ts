export interface SessionUser {
  id: string;
  email: string;
  role: any;
  name?: string;
  sessionStartTime?: Date;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  user: SessionUser;
  sessionInfo: {
    sessionId: string;
    expiresAt: Date;
    createdAt: Date;
  };
}

// Extend Express Session interface
// declare module 'express-session' {
//   interface SessionData {
//     user?: SessionUser;
//     loginAttempts?: number;
//     lastLoginAttempt?: Date;
//     createdAt?: Date;
//   }
// }
