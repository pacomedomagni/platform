import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const API_KEY_HEADER = 'x-api-key';
export const REQUIRE_API_KEY = 'requireApiKey';

/**
 * Decorator to require API key authentication
 * @example @RequireApiKey()
 */
export const RequireApiKey = () => {
  return (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata(REQUIRE_API_KEY, true, descriptor.value);
      return descriptor;
    }
    Reflect.defineMetadata(REQUIRE_API_KEY, true, target);
    return target;
  };
};

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requireApiKey = this.reflector.getAllAndOverride<boolean>(REQUIRE_API_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If API key is not required, allow access
    if (!requireApiKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers[API_KEY_HEADER];

    // Get the expected API key from environment
    const expectedApiKey = process.env['PROVISION_API_KEY'];

    if (!expectedApiKey) {
      // If no API key is configured, deny access in production
      if (process.env['NODE_ENV'] === 'production') {
        throw new UnauthorizedException('API key authentication not configured');
      }
      // In development, allow access without API key
      return true;
    }

    if (!apiKey) {
      throw new UnauthorizedException('API key required');
    }

    if (apiKey !== expectedApiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
