import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to extract current customer ID from request
 * Must be used with JwtAuthGuard or CustomerAuthGuard
 */
export const CurrentCustomer = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.customerId;
  },
);
