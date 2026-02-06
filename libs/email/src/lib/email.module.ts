import { Module, DynamicModule, Global } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailTemplateService } from './template.service';
import { EmailModuleOptions, EMAIL_MODULE_OPTIONS } from './email.types';

@Global()
@Module({})
export class EmailModule {
  static forRoot(options: EmailModuleOptions): DynamicModule {
    return {
      module: EmailModule,
      providers: [
        {
          provide: EMAIL_MODULE_OPTIONS,
          useValue: options,
        },
        EmailTemplateService,
        EmailService,
      ],
      exports: [EmailService, EmailTemplateService],
    };
  }

  static forRootAsync(options: {
    useFactory: (...args: any[]) => Promise<EmailModuleOptions> | EmailModuleOptions;
    inject?: any[];
  }): DynamicModule {
    return {
      module: EmailModule,
      providers: [
        {
          provide: EMAIL_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        EmailTemplateService,
        EmailService,
      ],
      exports: [EmailService, EmailTemplateService],
    };
  }
}
