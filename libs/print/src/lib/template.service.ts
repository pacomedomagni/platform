import { Injectable, Logger } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as path from 'path';
import { RenderContext } from './print.types';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  private readonly compiledTemplates: Map<string, Handlebars.TemplateDelegate> = new Map();
  private readonly handlebars: typeof Handlebars;

  constructor() {
    this.handlebars = Handlebars.create();
    this.registerHelpers();
  }

  private registerHelpers(): void {
    // Format number with decimal places
    this.handlebars.registerHelper('formatNumber', (value: number, decimals = 2) => {
      if (typeof value !== 'number') return value;
      return value.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    });

    // Format currency
    this.handlebars.registerHelper('formatCurrency', (value: number, currency = 'USD', locale = 'en-US') => {
      if (typeof value !== 'number') return value;
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
      }).format(value);
    });

    // Format date
    this.handlebars.registerHelper('formatDate', (value: string | Date, format = 'short', locale = 'en-US') => {
      if (!value) return '';
      const date = new Date(value);
      if (format === 'short') {
        return date.toLocaleDateString(locale);
      } else if (format === 'long') {
        return date.toLocaleDateString(locale, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      } else if (format === 'iso') {
        return date.toISOString().split('T')[0];
      }
      return date.toLocaleDateString(locale);
    });

    // Format datetime
    this.handlebars.registerHelper('formatDateTime', (value: string | Date, locale = 'en-US') => {
      if (!value) return '';
      const date = new Date(value);
      return date.toLocaleString(locale);
    });

    // Math operations
    this.handlebars.registerHelper('add', (a: number, b: number) => a + b);
    this.handlebars.registerHelper('subtract', (a: number, b: number) => a - b);
    this.handlebars.registerHelper('multiply', (a: number, b: number) => a * b);
    this.handlebars.registerHelper('divide', (a: number, b: number) => b !== 0 ? a / b : 0);
    this.handlebars.registerHelper('percentage', (value: number, total: number) => 
      total !== 0 ? ((value / total) * 100).toFixed(2) : '0.00'
    );

    // Comparison helpers
    this.handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
    this.handlebars.registerHelper('ne', (a: unknown, b: unknown) => a !== b);
    this.handlebars.registerHelper('lt', (a: number, b: number) => a < b);
    this.handlebars.registerHelper('lte', (a: number, b: number) => a <= b);
    this.handlebars.registerHelper('gt', (a: number, b: number) => a > b);
    this.handlebars.registerHelper('gte', (a: number, b: number) => a >= b);

    // Logical helpers
    this.handlebars.registerHelper('and', (...args: unknown[]) => {
      args.pop(); // Remove options object
      return args.every(Boolean);
    });
    this.handlebars.registerHelper('or', (...args: unknown[]) => {
      args.pop(); // Remove options object
      return args.some(Boolean);
    });
    this.handlebars.registerHelper('not', (value: unknown) => !value);

    // String helpers
    this.handlebars.registerHelper('uppercase', (str: string) => str?.toUpperCase() || '');
    this.handlebars.registerHelper('lowercase', (str: string) => str?.toLowerCase() || '');
    this.handlebars.registerHelper('capitalize', (str: string) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });
    this.handlebars.registerHelper('truncate', (str: string, length: number) => {
      if (!str) return '';
      return str.length > length ? str.substring(0, length) + '...' : str;
    });
    this.handlebars.registerHelper('padStart', (str: string, length: number, char = '0') => 
      String(str).padStart(length, char)
    );
    this.handlebars.registerHelper('replace', (str: string, search: string, replace: string) => 
      str?.replace(new RegExp(search, 'g'), replace) || ''
    );

    // Array helpers
    this.handlebars.registerHelper('length', (arr: unknown[]) => arr?.length || 0);
    this.handlebars.registerHelper('first', (arr: unknown[]) => arr?.[0]);
    this.handlebars.registerHelper('last', (arr: unknown[]) => arr?.[arr.length - 1]);
    this.handlebars.registerHelper('join', (arr: unknown[], separator = ', ') => arr?.join(separator) || '');
    this.handlebars.registerHelper('sum', (arr: number[]) => arr?.reduce((a, b) => a + b, 0) || 0);

    // Index helper (1-based)
    this.handlebars.registerHelper('rowNumber', (index: number) => index + 1);

    // Conditional class helper
    this.handlebars.registerHelper('classIf', (condition: boolean, className: string) => 
      condition ? className : ''
    );

    // Default value helper
    this.handlebars.registerHelper('default', (value: unknown, defaultValue: unknown) => 
      value ?? defaultValue
    );

    // JSON stringify helper
    this.handlebars.registerHelper('json', (value: unknown) => JSON.stringify(value, null, 2));

    // Barcode placeholder (would need actual implementation)
    this.handlebars.registerHelper('barcode', (value: string, type = 'code128') => 
      `<div class="barcode" data-type="${type}" data-value="${value}">${value}</div>`
    );

    // QR code placeholder (would need actual implementation)
    this.handlebars.registerHelper('qrcode', (value: string, size = 100) => 
      `<div class="qrcode" data-size="${size}" data-value="${value}"></div>`
    );

    // Amount in words (simplified)
    this.handlebars.registerHelper('amountInWords', (amount: number, currency = 'USD') => {
      // Simplified implementation - would need a proper library for production
      const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
      const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
      const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

      const convertLessThanThousand = (num: number): string => {
        if (num === 0) return '';
        if (num < 10) return ones[num];
        if (num < 20) return teens[num - 10];
        if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
        return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + convertLessThanThousand(num % 100) : '');
      };

      const wholePart = Math.floor(amount);
      const decimalPart = Math.round((amount - wholePart) * 100);

      let words = '';
      if (wholePart >= 1000000) {
        words += convertLessThanThousand(Math.floor(wholePart / 1000000)) + ' Million ';
        words += convertLessThanThousand(Math.floor((wholePart % 1000000) / 1000)) + ' Thousand ';
        words += convertLessThanThousand(wholePart % 1000);
      } else if (wholePart >= 1000) {
        words += convertLessThanThousand(Math.floor(wholePart / 1000)) + ' Thousand ';
        words += convertLessThanThousand(wholePart % 1000);
      } else {
        words = convertLessThanThousand(wholePart);
      }

      words = words.trim() + ' ' + currency;
      if (decimalPart > 0) {
        words += ' and ' + convertLessThanThousand(decimalPart) + ' Cents';
      }

      return words.trim() || 'Zero ' + currency;
    });
  }

  /**
   * Register a partial template
   */
  registerPartial(name: string, template: string): void {
    this.handlebars.registerPartial(name, template);
  }

  /**
   * Register partials from files in a directory
   */
  async registerPartialsFromDirectory(partialsPath: string): Promise<void> {
    try {
      const files = await fs.readdir(partialsPath);
      for (const file of files) {
        if (file.endsWith('.hbs') || file.endsWith('.html')) {
          const name = path.basename(file, path.extname(file));
          const content = await fs.readFile(path.join(partialsPath, file), 'utf-8');
          this.registerPartial(name, content);
          this.logger.debug(`Registered partial: ${name}`);
        }
      }
    } catch (error) {
      this.logger.warn(`Could not load partials from ${partialsPath}`);
    }
  }

  /**
   * Compile a template string
   */
  compile(template: string): Handlebars.TemplateDelegate {
    return this.handlebars.compile(template);
  }

  /**
   * Load and compile a template from file
   */
  async loadTemplate(templatePath: string, cache = true): Promise<Handlebars.TemplateDelegate> {
    if (cache && this.compiledTemplates.has(templatePath)) {
      return this.compiledTemplates.get(templatePath)!;
    }

    const content = await fs.readFile(templatePath, 'utf-8');
    const compiled = this.compile(content);

    if (cache) {
      this.compiledTemplates.set(templatePath, compiled);
    }

    return compiled;
  }

  /**
   * Render a template with context
   */
  render(template: Handlebars.TemplateDelegate, context: RenderContext): string {
    return template(context);
  }

  /**
   * Render a template string with context
   */
  renderString(templateString: string, context: RenderContext): string {
    const template = this.compile(templateString);
    return template(context);
  }

  /**
   * Clear the template cache
   */
  clearCache(): void {
    this.compiledTemplates.clear();
    this.logger.debug('Template cache cleared');
  }

  /**
   * Get a compiled template from cache
   */
  getCachedTemplate(templatePath: string): Handlebars.TemplateDelegate | undefined {
    return this.compiledTemplates.get(templatePath);
  }
}
