import { Module, DynamicModule, Global, InjectionToken, OptionalFactoryDependency, Provider } from '@nestjs/common';
import { StorageService } from './storage.service';
import {
  StorageModuleOptions,
  STORAGE_MODULE_OPTIONS,
  STORAGE_PROVIDER,
} from './storage.types';
import { S3StorageProvider } from './providers/s3.provider';
import { LocalStorageProvider } from './providers/local.provider';

type InjectArray = (InjectionToken | OptionalFactoryDependency)[];

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
    useFactory: (...args: any[]) => Promise<StorageModuleOptions> | StorageModuleOptions;
    inject?: InjectArray;
  }): DynamicModule {
    const injectTokens: InjectArray = options.inject || [];
    
    const providerFactory: Provider = {
      provide: STORAGE_PROVIDER,
      useFactory: async (...args: any[]) => {
        const config = await options.useFactory(...args);
        if (config.provider.type === 's3') {
          return new S3StorageProvider(config.provider);
        } else {
          return new LocalStorageProvider(config.provider);
        }
      },
      inject: injectTokens,
    };

    return {
      module: StorageModule,
      providers: [
        {
          provide: STORAGE_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: injectTokens,
        },
        providerFactory,
        StorageService,
      ],
      exports: [StorageService],
    };
  }
}
