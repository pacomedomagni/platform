import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

class RefreshTokenDto {
  @IsString()
  @MinLength(1)
  refresh_token!: string;
}

@Controller('auth')
@Throttle({ short: { limit: 3, ttl: 1000 }, medium: { limit: 10, ttl: 60000 } })
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('login')
    async login(@Body() body: LoginDto) {
        if (process.env['ENABLE_DEV_PASSWORD_LOGIN'] !== 'true') {
            throw new UnauthorizedException('Password login disabled; use Keycloak/OIDC');
        }
        const user = await this.authService.validateUser(body.email, body.password);
        if (!user) {
            throw new UnauthorizedException();
        }
        return this.authService.login(user);
    }

    @Post('refresh')
    @Throttle({ short: { limit: 5, ttl: 1000 }, medium: { limit: 20, ttl: 60000 } })
    async refresh(@Body() body: RefreshTokenDto) {
        return this.authService.refreshAccessToken(body.refresh_token);
    }
}
