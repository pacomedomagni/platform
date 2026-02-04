import { Module, DynamicModule, Global } from '@nestjs/common';
import { PrintService } from './print.service';
import { TemplateService } from './template.service';
import { PrintModuleOptions, PRINT_MODULE_OPTIONS } from './print.types';

@Global()
@Module({})
export class PrintModule {
  static forRoot(options: PrintModuleOptions): DynamicModule {
    return {
      module: PrintModule,
      providers: [
        {
          provide: PRINT_MODULE_OPTIONS,
          useValue: options,
        },
        TemplateService,
        PrintService,
      ],
      exports: [PrintService, TemplateService],
    };
  }

  static forRootAsync(options: {
    useFactory: (...args: unknown[]) => Promise<PrintModuleOptions> | PrintModuleOptions;
    inject?: unknown[];
  }): DynamicModule {
    return {
      module: PrintModule,
      providers: [
        {
          provide: PRINT_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        TemplateService,
        PrintService,
      ],
      exports: [PrintService, TemplateService],
    };
  }
}
