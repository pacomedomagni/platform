export * from './lib/auth.module';
export * from './lib/jwt.strategy';
export * from './lib/auth.service';
export * from './lib/guards';

// Re-export Passport's AuthGuard with 'jwt' as default
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
export const AuthGuard = PassportAuthGuard('jwt');
