import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const SALT_ROUNDS = 12;
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

// O-8: precomputed bcrypt hash used by validateUser() when the email does not
// exist, so the bcrypt.compare cost is paid on both paths. Generated once at
// module load with the same cost factor as real password hashes.
const DUMMY_BCRYPT_HASH = bcrypt.hashSync(
    'O-8 timing-equalizer dummy — never matches a real password',
    SALT_ROUNDS,
);

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

        // O-8: equalize timing across "user not found" and "wrong password".
        // The previous code returned immediately on missing user, which made
        // the missing-user path observably faster (no bcrypt) and allowed an
        // attacker to enumerate registered emails by timing login attempts.
        // We always run bcrypt.compare against either the real hash or a
        // dummy hash of equivalent cost. The dummy is computed once per
        // process at module load and reused; bcrypt.compare on it always
        // returns false in roughly the same time as a real wrong-password.
        const hashToCheck =
            user?.password && /^\$2[aby]\$/.test(user.password)
                ? user.password
                : DUMMY_BCRYPT_HASH;

        const isValid = await this.verifyPassword(pass, hashToCheck);

        // Legacy plaintext detection still happens, but only AFTER bcrypt has
        // run so the timing path is identical. Throws a distinct error only
        // for genuine logged-in users on the legacy format — not on missing
        // users where we'd be leaking enumeration via the error type.
        if (
            user &&
            user.password &&
            !/^\$2[aby]\$/.test(user.password)
        ) {
            throw new UnauthorizedException(
                'Your password must be reset. Please use the forgot password flow.'
            );
        }

        if (user && isValid) {
            const { password, ...result } = user;
            return result;
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

        const accessToken = jwt.sign(payload, jwtSecret, {
            expiresIn: '15m',
            algorithm: 'HS256', // Phase 1 W1.5: pin algorithm
        });
        const refreshToken = await this.createRefreshToken(user.id, user.tenantId);

        // 6.13: surface the tenant's base currency on login so the admin UI
        // can format prices correctly without falling back to a hardcoded
        // USD. Stored in localStorage by the login handler.
        const tenant = await this.db.tenant.findUnique({
            where: { id: user.tenantId },
            select: { baseCurrency: true },
        });

        return {
            access_token: accessToken,
            refresh_token: refreshToken,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                tenantId: user.tenantId,
                roles: user.roles,
                baseCurrency: tenant?.baseCurrency || 'USD',
            },
        };
    }

    /**
     * Refresh access token using a valid refresh token.
     *
     * Phase 1 W1.5: atomic rotation. The previous implementation did four
     * non-atomic steps (read -> validate -> revoke -> create) which let two
     * concurrent clients that captured the same token both complete the
     * rotation before either revoke landed. This version wraps the
     * validate+revoke+create in a Prisma transaction with `SELECT ... FOR
     * UPDATE` on the refresh-token row so only one rotation wins.
     */
    async refreshAccessToken(refreshTokenValue: string) {
        const jwtSecret = process.env['JWT_SECRET'];
        if (!jwtSecret) {
            throw new Error('JWT_SECRET must be set');
        }

        const result = await this.db.$transaction(async (tx) => {
            // SELECT ... FOR UPDATE serializes concurrent rotations of the
            // same token. Prisma doesn't expose FOR UPDATE on model-level
            // calls so we use $queryRaw for the lock.
            const locked = await tx.$queryRaw<Array<{ id: string; revokedAt: Date | null; expiresAt: Date; userId: string }>>`
                SELECT id, "revokedAt", "expiresAt", "userId"
                FROM refresh_tokens
                WHERE token = ${refreshTokenValue}
                FOR UPDATE
            `;

            const tokenRow = locked[0];
            if (!tokenRow) {
                throw new UnauthorizedException('Invalid refresh token');
            }
            if (tokenRow.revokedAt) {
                throw new UnauthorizedException('Refresh token has been revoked');
            }
            if (tokenRow.expiresAt < new Date()) {
                throw new UnauthorizedException('Refresh token has expired');
            }

            await tx.refreshToken.update({
                where: { id: tokenRow.id },
                data: { revokedAt: new Date() },
            });

            const user = await tx.user.findUnique({ where: { id: tokenRow.userId } });
            if (!user) {
                throw new UnauthorizedException('Invalid refresh token');
            }

            const newToken = crypto.randomBytes(64).toString('hex');
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
            await tx.refreshToken.create({
                data: {
                    token: newToken,
                    userId: user.id,
                    tenantId: user.tenantId,
                    expiresAt,
                },
            });

            return { user, newRefreshToken: newToken };
        });

        const payload = {
            username: result.user.email,
            email: result.user.email,
            sub: result.user.id,
            tenant_id: result.user.tenantId,
            roles: result.user.roles,
            iss: 'admin',
            aud: 'admin',
        };

        const accessToken = jwt.sign(payload, jwtSecret, {
            expiresIn: '15m',
            algorithm: 'HS256', // Phase 1 W1.5: pin algorithm
        });

        return {
            access_token: accessToken,
            refresh_token: result.newRefreshToken,
        };
    }

    private async createRefreshToken(userId: string, tenantId: string): Promise<string> {
        const token = crypto.randomBytes(64).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

        await this.db.refreshToken.create({
            data: {
                token,
                userId,
                tenantId,
                expiresAt,
            },
        });

        return token;
    }
}
