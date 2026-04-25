import { Module, DynamicModule, Global } from '@nestjs/common';
import { QueueService } from './queue.service';
import { DistributedLockService } from './distributed-lock.service';
import { QueueModuleOptions, QUEUE_MODULE_OPTIONS } from './queue.types';

@Global()
@Module({})
export class QueueModule {
  static forRoot(options: QueueModuleOptions): DynamicModule {
    return {
      module: QueueModule,
      providers: [
        {
          provide: QUEUE_MODULE_OPTIONS,
          useValue: options,
        },
        QueueService,
        DistributedLockService,
      ],
      exports: [QueueService, DistributedLockService],
    };
  }

  static forRootAsync(options: {
    useFactory: (...args: any[]) => Promise<QueueModuleOptions> | QueueModuleOptions;
    inject?: any[];
  }): DynamicModule {
    return {
      module: QueueModule,
      providers: [
        {
          provide: QUEUE_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: (options.inject || []) as any[],
        },
        QueueService,
        DistributedLockService,
      ],
      exports: [QueueService, DistributedLockService],
    };
  }
}
