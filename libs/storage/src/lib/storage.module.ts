import { Module, DynamicModule, Global, InjectionToken } from '@nestjs/common';
import { StorageService } from './storage.service';
import {
  StorageModuleOptions,
  STORAGE_MODULE_OPTIONS,
  STORAGE_PROVIDER,
} from './storage.types';
import { S3StorageProvider } from './providers/s3.provider';
import { LocalStorageProvider } from './providers/local.provider';

@Global()
@Module({})
export class StorageModule {
  static forRoot(options: StorageModuleOptions): DynamicModule {
    const providerFactory = {
      provide: STORAGE_PROVIDER,
      useFactory: () => {
        if (options.provider.type === 's3') {
          return new S3StorageProvider(options.provider);
        } else {
          return new LocalStorageProvider(options.provider);
        }
      },
    };

    return {
      module: StorageModule,
      providers: [
        {
          provide: STORAGE_MODULE_OPTIONS,
          useValue: options,
        },
        providerFactory,
        StorageService,
      ],
      exports: [StorageService],
    };
  }

  static forRootAsync(options: {
    useFactory: (...args: unknown[]) => Promise<StorageModuleOptions> | StorageModuleOptions;
    inject?: InjectionToken[];
  }): DynamicModule {
    const providerFactory = {
      provide: STORAGE_PROVIDER,
      useFactory: async (...args: unknown[]) => {
        const config = await options.useFactory(...args);
        if (config.provider.type === 's3') {
          return new S3StorageProvider(config.provider);
        } else {
          return new LocalStorageProvider(config.provider);
        }
      },
      inject: options.inject || [],
    };

    return {
      module: StorageModule,
      providers: [
        {
          provide: STORAGE_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        providerFactory,
        StorageService,
      ],
      exports: [StorageService],
    };
  }
}
