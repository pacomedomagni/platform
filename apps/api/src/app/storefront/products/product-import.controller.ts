import {
  Controller,
  Post,
  Get,
  Param,
  Headers,
  BadRequestException,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StoreAdminGuard } from '@platform/auth';
import { ProductImportService } from './product-import.service';

@Controller('store/admin/products/import')
@UseGuards(StoreAdminGuard)
export class ProductImportController {
  constructor(private readonly importService: ProductImportService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (_req, file, cb) => {
        if (
          file.mimetype === 'text/csv' ||
          file.originalname.endsWith('.csv')
        ) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only CSV files are allowed'), false);
        }
      },
    }),
  )
  async startImport(
    @Headers('x-tenant-id') tenantId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }
    return this.importService.startImport(tenantId, file);
  }

  @Get(':jobId')
  async getImportStatus(
    @Headers('x-tenant-id') tenantId: string,
    @Param('jobId') jobId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.importService.getImportStatus(tenantId, jobId);
  }

  @Get()
  async listImports(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.importService.listImports(tenantId);
  }
}
