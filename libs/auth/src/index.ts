export * from './lib/auth.module';
export * from './lib/jwt.strategy';
export * from './lib/auth.service';
export * from './lib/guards';

// Re-export our JWT guard with tenant match enforcement
export { JwtTenantGuard as AuthGuard } from './lib/guards';
