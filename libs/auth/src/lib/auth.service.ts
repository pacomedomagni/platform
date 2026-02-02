import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DbService } from '@platform/db';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
    // TODO: Move to Env
    private readonly JWT_SECRET = process.env.JWT_SECRET || 'secretKey';

    constructor(private readonly db: DbService) {}

    async validateUser(email: string, pass: string): Promise<any> {
        const user = await this.db.user.findUnique({ where: { email } });
        if (user && user.password === pass) {
            const { password, ...result } = user;
            return result;
        }
        return null;
    }

    async login(user: any) {
        const payload = { 
            username: user.email, 
            sub: user.id,
            tenantId: user.tenantId,
            roles: user.roles 
        };
        
        return {
            access_token: jwt.sign(payload, this.JWT_SECRET, { expiresIn: '1d' }),
            user: user
        };
    }
}
