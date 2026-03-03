import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DocService } from './doc.service';
import { SchemaService } from './schema.service';
import { DocTypeDefinition } from './types';

// H-DT-5: All endpoints require JWT authentication via class-level guard
@Controller()
@UseGuards(AuthGuard('jwt'))
export class UniversalController {
  constructor(
    private readonly docService: DocService,
    private readonly schemaService: SchemaService
  ) {}

  // --- Meta Definitions ---

  @Get('meta')
  async listDocTypes() {
      return this.schemaService.listDocTypes();
  }

  @Get('meta/:name')
  async getDocType(@Param('name') name: string) {
    const docType = await this.schemaService.getDocType(name);
    return docType || { error: 'Not Found' };
  }

  @Post('meta')
  async syncDocType(@Body() def: DocTypeDefinition, @Req() req: any) {
    const roles: string[] = req.user?.roles || [];
    if (!roles.includes('admin') && !roles.includes('System Manager')) {
      throw new ForbiddenException('Only admins can sync metadata');
    }
    await this.schemaService.syncDocType(def);
    return { status: 'synced', name: def.name };
  }

  // --- Generic Data Operations ---

  @Post(':doctype')
  async create(@Param('doctype') docType: string, @Body() body: any, @Req() req: any) {
    return this.docService.create(docType, body, req.user);
  }

  @Get(':doctype')
  async list(
    @Param('doctype') docType: string,
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.docService.findAll(docType, req.user, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get(':doctype/:name')
  async read(@Param('doctype') docType: string, @Param('name') name: string, @Req() req: any) {
    return this.docService.findOne(docType, name, req.user);
  }

  @Put(':doctype/:name')
  async update(
    @Param('doctype') docType: string,
    @Param('name') name: string,
    @Body() body: any,
    @Req() req: any
  ) {
    return this.docService.update(docType, name, body, req.user);
  }

  @Delete(':doctype/:name')
  async delete(@Param('doctype') docType: string, @Param('name') name: string, @Req() req: any) {
    return this.docService.delete(docType, name, req.user);
  }

  @Put(':doctype/:name/submit')
  async submit(@Param('doctype') docType: string, @Param('name') name: string, @Req() req: any) {
    return this.docService.submit(docType, name, req.user);
  }

  @Put(':doctype/:name/cancel')
  async cancel(@Param('doctype') docType: string, @Param('name') name: string, @Req() req: any) {
    return this.docService.cancel(docType, name, req.user);
  }
}
