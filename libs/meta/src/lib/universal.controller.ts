import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DocService } from './doc.service';
import { SchemaService } from './schema.service';
import { DocTypeDefinition } from './types';

@Controller('api/v1')
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
    return docType || { error: 'Not Found' }; // Or throw NotFoundException
  }

  // Meta sync should likely be restricted to admin only, but for now we follow same pattern or just public/dev?
  // Let's protect it but maybe with a specific permission or just allow ANY auth for now (dangerous, but matching "user" request).
  @Post('meta')
  @UseGuards(AuthGuard('jwt')) 
  async syncDocType(@Body() def: DocTypeDefinition) {
    // TODO: Enforce System Manager only
    await this.schemaService.syncDocType(def);
    return { status: 'synced', name: def.name };
  }

  // --- Generic Data Operations ---

  @Post(':doctype')
  @UseGuards(AuthGuard('jwt'))
  async create(@Param('doctype') docType: string, @Body() body: any, @Req() req: any) {
    return this.docService.create(docType, body, req.user);
  }

  @Get(':doctype')
  @UseGuards(AuthGuard('jwt'))
  async list(@Param('doctype') docType: string, @Req() req: any) {
    return this.docService.findAll(docType, req.user);
  }

  @Get(':doctype/:name')
  @UseGuards(AuthGuard('jwt'))
  async read(@Param('doctype') docType: string, @Param('name') name: string, @Req() req: any) {
    return this.docService.findOne(docType, name, req.user);
  }

  @Put(':doctype/:name')
  @UseGuards(AuthGuard('jwt'))
  async update(
    @Param('doctype') docType: string, 
    @Param('name') name: string, 
    @Body() body: any,
    @Req() req: any
  ) {
    return this.docService.update(docType, name, body, req.user);
  }

  @Delete(':doctype/:name')
  @UseGuards(AuthGuard('jwt'))
  async delete(@Param('doctype') docType: string, @Param('name') name: string, @Req() req: any) {
    return this.docService.delete(docType, name, req.user);
  }

  @Put(':doctype/:name/submit')
  @UseGuards(AuthGuard('jwt'))
  async submit(@Param('doctype') docType: string, @Param('name') name: string, @Req() req: any) {
    return this.docService.submit(docType, name, req.user);
  }

  @Put(':doctype/:name/cancel')
  @UseGuards(AuthGuard('jwt'))
  async cancel(@Param('doctype') docType: string, @Param('name') name: string, @Req() req: any) {
    return this.docService.cancel(docType, name, req.user);
  }
}
