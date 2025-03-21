import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { decode, verify } from "jsonwebtoken";

@Injectable()
export class AuthGuard implements CanActivate {

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.access_token;

    if (!token) {
      return false;
    }
    try {
      const verifiedToken = verify(token, 'your-secret-key');
      console.log(verifiedToken);
    } catch (error) {
        console.log(error);
    }
    const decoded = decode(token);
    request.headers.auth_user = decoded;
    return true;
  }
}