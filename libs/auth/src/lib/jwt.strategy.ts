import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  roles: string[];
  tenantId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const devSecret = process.env['JWT_SECRET'];
    // Phase 3 hardening: even if env-validator regresses or someone explicitly
    // sets ENABLE_DEV_PASSWORD_LOGIN=true in production, the strategy itself
    // refuses to ever accept HS256 in prod. The only path that should ever
    // reach the dev JWKS fallback is non-production with the flag explicitly on.
    const isProd = process.env['NODE_ENV'] === 'production';
    const useDevJwt =
      !isProd &&
      process.env['ENABLE_DEV_PASSWORD_LOGIN'] === 'true' &&
      Boolean(devSecret);

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      ...(useDevJwt
        ? {
            // useDevJwt is gated on Boolean(devSecret), so the cast is safe.
            secretOrKey: devSecret as string,
            algorithms: ['HS256'],
            issuer: 'admin',
            audience: 'admin',
          }
        : {
            secretOrKeyProvider: passportJwtSecret({
              cache: true,
              rateLimit: true,
              jwksRequestsPerMinute: 5,
              jwksUri:
                process.env['KEYCLOAK_JWKS_URI'] ||
                'http://localhost:8080/realms/noslag/protocol/openid-connect/certs',
            }),
            issuer: process.env['KEYCLOAK_ISSUER'] || 'http://localhost:8080/realms/noslag',
            algorithms: ['RS256'],
          }),
    });
  }

  async validate(payload: any): Promise<AuthenticatedUser> {
    // This payload is the decoded JWT
    // Return user context for the Request object
    return {
      userId: payload.sub,
      email: payload.email,
      roles: payload.roles || payload.realm_access?.roles || [],
      // Noslag Custom Claim for Tenant
      tenantId: payload.tenant_id, 
    };
  }
}
