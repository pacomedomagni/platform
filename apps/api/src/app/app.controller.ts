import { Body, Controller, Get, Post, Headers, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { AuthGuard } from '@nestjs/passport';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getData() {
    return this.appService.getData();
  }

  @Post('setup')
  setup() {
    return this.appService.setup();
  }

  // Create User: Requires valid JWT + Tenant Context
  @UseGuards(AuthGuard('jwt'))
  @Post('users')
  createUser(@Body() body: { email: string; tenantId: string }) {
    return this.appService.createUser(body.email, body.tenantId);
  }

  // List Users: Requires valid JWT + Tenant Context
  @UseGuards(AuthGuard('jwt'))
  @Get('users')
  getUsers() {
    return this.appService.getUsers();
  }
}
