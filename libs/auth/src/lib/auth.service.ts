import { Injectable } from '@nestjs/common';
import { PrismaService } from '@platform/db';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
    constructor(private readonly db: PrismaService) {}

    async validateUser(email: string, pass: string): Promise<any> {
        const user = await this.db.user.findUnique({ where: { email } });
        if (user && user.password === pass) {
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
