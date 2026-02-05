import { Injectable } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';

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
            // Check if password is bcrypt hashed (starts with $2b$ or $2a$)
            const isBcryptHash = user.password.startsWith('$2b$') || user.password.startsWith('$2a$');
            
            let isValid = false;
            if (isBcryptHash) {
                isValid = await this.verifyPassword(pass, user.password);
            } else {
                // Legacy plain-text comparison (for migration) - rehash on successful login
                isValid = user.password === pass;
                if (isValid) {
                    // Upgrade to bcrypt hash
                    const hashedPassword = await this.hashPassword(pass);
                    await this.db.user.update({
                        where: { id: user.id },
                        data: { password: hashedPassword }
                    });
                }
            }
            
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
            roles: user.roles 
        };
        
        return {
            access_token: jwt.sign(payload, jwtSecret, { expiresIn: '1d' }),
            user: user
        };
    }
}
