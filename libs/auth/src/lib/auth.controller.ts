import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('login')
    async login(@Body() body: any) {
        if (process.env.ENABLE_DEV_PASSWORD_LOGIN !== 'true') {
            throw new UnauthorizedException('Password login disabled; use Keycloak/OIDC');
        }
        const user = await this.authService.validateUser(body.email, body.password);
        if (!user) {
            throw new UnauthorizedException();
        }
        return this.authService.login(user);
    }
}
