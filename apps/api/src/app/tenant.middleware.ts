import { Injectable, NestMiddleware } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Request, Response, NextFunction } from 'express';
import { decode } from 'jsonwebtoken';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
    constructor(private readonly cls: ClsService) {}

    use(req: Request, res: Response, next: NextFunction) {
        // Strategy 1: Check Custom Header (Legacy/Dev)
        let tenantId = req.headers['x-tenant-id'] as string;

        // Strategy 2: Extract from JWT (Production)
        const authHeader = req.headers.authorization;
        if (!tenantId && authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                // Optimistic decode - Verification happens in AuthGuard later
                const payload: any = decode(token);
                if (payload && payload.tenant_id) {
                    tenantId = payload.tenant_id;
                }
            } catch (e) {
                // Ignore invalid tokens here
            }
        }

        if (tenantId) {
            this.cls.set('tenantId', tenantId);
        }
        next();
    }
}
