import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (!requiredRoles) return true;
    
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Populated by FirebaseAuthGuard

    // Check if the decoded Firebase ID token contains the required role claim
    if (!user || !user.role || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Access denied. Insufficient role permissions.');
    }
    return true;
  }
}