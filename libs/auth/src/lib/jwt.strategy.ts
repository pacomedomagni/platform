import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const devSecret = process.env.JWT_SECRET;
    const useDevJwt = process.env.ENABLE_DEV_PASSWORD_LOGIN === 'true' && Boolean(devSecret);

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      ...(useDevJwt
        ? {
            secretOrKey: devSecret,
            algorithms: ['HS256'],
          }
        : {
            secretOrKeyProvider: passportJwtSecret({
              cache: true,
              rateLimit: true,
              jwksRequestsPerMinute: 5,
              jwksUri: process.env.KEYCLOAK_JWKS_URI || 'http://localhost:8080/realms/noslag/protocol/openid-connect/certs',
            }),
            issuer: process.env.KEYCLOAK_ISSUER || 'http://localhost:8080/realms/noslag',
            algorithms: ['RS256'],
          }),
    });
  }

  async validate(payload: any) {
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
