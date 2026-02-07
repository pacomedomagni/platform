import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
    constructor(private readonly db: PrismaService) {}

    /**
     * Hash a password using bcrypt
     */
    async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, SALT_ROUNDS);
    }

    /**
     * Verify a password against a hash
     */
    async verifyPassword(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }

    async validateUser(email: string, pass: string): Promise<any> {
        const user = await this.db.user.findUnique({ where: { email } });
        if (user && user.password) {
            // Detect bcrypt format: $2a$, $2b$, $2y$ are all valid prefixes
            const isBcryptHash = /^\$2[aby]\$/.test(user.password);

            if (!isBcryptHash) {
                // Legacy plaintext password detected - force password reset
                throw new UnauthorizedException(
                    'Your password must be reset. Please use the forgot password flow.'
                );
            }

            const isValid = await this.verifyPassword(pass, user.password);

            if (isValid) {
                const { password, ...result } = user;
                return result;
            }
        }
        return null;
    }

    async login(user: any) {
        const jwtSecret = process.env['JWT_SECRET'];
        if (!jwtSecret) {
            throw new Error('JWT_SECRET must be set when ENABLE_DEV_PASSWORD_LOGIN=true');
        }
        const payload = {
            username: user.email,
            email: user.email,
            sub: user.id,
            tenant_id: user.tenantId,
            roles: user.roles,
            iss: 'admin',
            aud: 'admin',
        };

        return {
            access_token: jwt.sign(payload, jwtSecret, { expiresIn: '1d' }),
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                tenantId: user.tenantId,
                roles: user.roles,
            },
        };
    }
}
