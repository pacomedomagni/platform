import { Body, Controller, Get, Post, Headers, UseGuards, NotFoundException } from '@nestjs/common';
import { AppService } from './app.service';
import { AuthGuard } from '@platform/auth';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getData() {
    return this.appService.getData();
  }

  @Post('setup')
  setup() {
    const env = process.env['NODE_ENV'];
    if (env !== 'development' && env !== 'test') {
      throw new NotFoundException();
    }
    return this.appService.setup();
  }

  // Create User: Requires valid JWT + Tenant Context
  @UseGuards(AuthGuard)
  @Post('users')
  createUser(@Body() body: { email: string }) {
    return this.appService.createUser(body.email);
  }

  // List Users: Requires valid JWT + Tenant Context
  @UseGuards(AuthGuard)
  @Get('users')
  getUsers() {
    return this.appService.getUsers();
  }
}
