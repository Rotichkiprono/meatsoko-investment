import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import admin from 'firebase-admin';
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.split('Bearer ')[1];

    try {
      // Verify the JWT via Firebase Admin
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      // Attach the decoded token (which includes uid and email) to the request
      request.user = decodedToken;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired Firebase ID token');
    }
  }
}