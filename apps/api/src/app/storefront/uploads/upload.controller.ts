import {
  Controller,
  Post,
  Headers,
  BadRequestException,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StoreAdminGuard } from '@platform/auth';
import { StorageService } from '@platform/storage';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

@Controller('store/admin')
export class UploadController {
  constructor(private readonly storageService: StorageService) {}

  @Post('uploads')
  @UseGuards(StoreAdminGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  async uploadFile(
    @Headers('x-tenant-id') tenantId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
      );
    }

    const result = await this.storageService.uploadFile(
      tenantId,
      file.originalname,
      file.buffer,
      {
        prefix: 'products',
        contentType: file.mimetype,
      },
    );

    return {
      url: result.url,
      key: result.key,
    };
  }
}
