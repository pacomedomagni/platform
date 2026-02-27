import { Injectable } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Semantic alias for JwtAuthGuard, used on storefront customer-facing endpoints.
 * Keeping this as a distinct class allows us to:
 * 1. Apply customer-specific logic (e.g. isActive checks) in the future without
 *    changing every controller import.
 * 2. Differentiate customer guards from admin guards in provider registrations.
 * 3. Provide clearer intent when reading controller decorators (@UseGuards(CustomerAuthGuard)).
 */
@Injectable()
export class CustomerAuthGuard extends JwtAuthGuard {}
