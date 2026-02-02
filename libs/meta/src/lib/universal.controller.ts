import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
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
  
  @Get('meta/:name')
  async getDocType(@Param('name') name: string) {
    const docType = await this.schemaService.getDocType(name);
    return docType || { error: 'Not Found' }; // Or throw NotFoundException
  }

  @Post('meta')
  async syncDocType(@Body() def: DocTypeDefinition) {
    await this.schemaService.syncDocType(def);
    return { status: 'synced', name: def.name };
  }

  // --- Generic Data Operations ---

  @Post(':doctype')
  async create(@Param('doctype') docType: string, @Body() body: any) {
    return this.docService.create(docType, body);
  }

  @Get(':doctype')
  async list(@Param('doctype') docType: string) {
    return this.docService.findAll(docType);
  }

  @Get(':doctype/:name')
  async read(@Param('doctype') docType: string, @Param('name') name: string) {
    return this.docService.findOne(docType, name);
  }

  @Put(':doctype/:name')
  async update(
    @Param('doctype') docType: string, 
    @Param('name') name: string, 
    @Body() body: any
  ) {
    return this.docService.update(docType, name, body);
  }

  @Delete(':doctype/:name')
  async delete(@Param('doctype') docType: string, @Param('name') name: string) {
    return this.docService.delete(docType, name);
  }
}
