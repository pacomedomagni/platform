import { createZodDto } from 'nestjs-zod';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '@platform/validation';

/**
 * Zod-based DTOs for customer authentication
 * These DTOs use the shared validation schemas from @platform/validation
 */

export class RegisterCustomerZodDto extends createZodDto(
  registerSchema.omit({ confirmPassword: true })
) {}

export class LoginCustomerZodDto extends createZodDto(loginSchema) {}

export class ForgotPasswordZodDto extends createZodDto(forgotPasswordSchema) {}

export class ResetPasswordZodDto extends createZodDto(
  resetPasswordSchema.omit({ confirmPassword: true })
) {}

export class ChangePasswordZodDto extends createZodDto(
  changePasswordSchema.omit({ confirmNewPassword: true })
) {}
