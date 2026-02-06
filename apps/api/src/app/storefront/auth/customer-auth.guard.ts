import { Injectable } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Alias for JwtAuthGuard - used for customer-specific endpoints
 */
@Injectable()
export class CustomerAuthGuard extends JwtAuthGuard {}
