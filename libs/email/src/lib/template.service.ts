import { Injectable, Logger } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as path from 'path';
import { EmailTemplate } from './email.types';

@Injectable()
export class EmailTemplateService {
  private readonly logger = new Logger(EmailTemplateService.name);
  private readonly compiledTemplates: Map<string, {
    subject: Handlebars.TemplateDelegate;
    html: Handlebars.TemplateDelegate;
    text?: Handlebars.TemplateDelegate;
  }> = new Map();
  private readonly handlebars: typeof Handlebars;

  constructor() {
    this.handlebars = Handlebars.create();
    this.registerHelpers();
    this.registerDefaultPartials();
  }

  private registerHelpers(): void {
    // Format date
    this.handlebars.registerHelper('formatDate', (value: string | Date, format = 'short') => {
      if (!value) return '';
      const date = new Date(value);
      if (format === 'long') {
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      }
      return date.toLocaleDateString('en-US');
    });

    // Format currency
    this.handlebars.registerHelper('formatCurrency', (value: number, currency = 'USD') => {
      if (typeof value !== 'number') return value;
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
      }).format(value);
    });

    // Comparison helpers
    this.handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
    this.handlebars.registerHelper('ne', (a: unknown, b: unknown) => a !== b);

    // String helpers
    this.handlebars.registerHelper('uppercase', (str: string) => str?.toUpperCase() || '');
    this.handlebars.registerHelper('lowercase', (str: string) => str?.toLowerCase() || '');
    this.handlebars.registerHelper('capitalize', (str: string) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });

    // Default value
    this.handlebars.registerHelper('default', (value: unknown, defaultValue: unknown) => 
      value ?? defaultValue
    );

    // Truncate text
    this.handlebars.registerHelper('truncate', (str: string, length: number) => {
      if (!str) return '';
      return str.length > length ? str.substring(0, length) + '...' : str;
    });

    // Safe line breaks for plain text
    this.handlebars.registerHelper('lineBreak', () => '\n');
  }

  private registerDefaultPartials(): void {
    // Email header partial
    this.handlebars.registerPartial('emailHeader', `
      <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-bottom: 1px solid #e2e8f0;">
        {{#if company.logo}}
        <img src="{{company.logo}}" alt="{{company.name}}" style="max-height: 50px; margin-bottom: 10px;">
        {{else}}
        <h1 style="margin: 0; color: #1e293b; font-size: 24px;">{{company.name}}</h1>
        {{/if}}
      </div>
    `);

    // Email footer partial
    this.handlebars.registerPartial('emailFooter', `
      <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0; margin-top: 30px;">
        <p style="margin: 0 0 10px 0; color: #64748b; font-size: 12px;">
          {{#if company.website}}<a href="{{company.website}}" style="color: #3b82f6;">{{company.website}}</a>{{/if}}
        </p>
        <p style="margin: 0; color: #94a3b8; font-size: 11px;">
          This email was sent by {{company.name}}.
          {{#if company.supportEmail}}Questions? Contact us at <a href="mailto:{{company.supportEmail}}" style="color: #3b82f6;">{{company.supportEmail}}</a>{{/if}}
        </p>
      </div>
    `);

    // Button partial
    this.handlebars.registerPartial('button', `
      <a href="{{url}}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;">{{text}}</a>
    `);
  }

  /**
   * Register a custom partial
   */
  registerPartial(name: string, template: string): void {
    this.handlebars.registerPartial(name, template);
  }

  /**
   * Compile and cache a template
   */
  compileTemplate(template: EmailTemplate): void {
    const compiled = {
      subject: this.handlebars.compile(template.subject),
      html: this.handlebars.compile(template.html),
      text: template.text ? this.handlebars.compile(template.text) : undefined,
    };
    this.compiledTemplates.set(template.name, compiled);
    this.logger.debug(`Compiled email template: ${template.name}`);
  }

  /**
   * Load and compile a template from file
   */
  async loadTemplate(templatesPath: string, templateName: string): Promise<void> {
    const htmlPath = path.join(templatesPath, `${templateName}.html`);
    const textPath = path.join(templatesPath, `${templateName}.txt`);
    const subjectPath = path.join(templatesPath, `${templateName}.subject`);

    let subject = templateName.replace(/-/g, ' ');
    let html = '';
    let text: string | undefined;

    try {
      html = await fs.readFile(htmlPath, 'utf-8');
    } catch {
      throw new Error(`Email template HTML not found: ${htmlPath}`);
    }

    try {
      subject = await fs.readFile(subjectPath, 'utf-8');
    } catch {
      // Use default subject
    }

    try {
      text = await fs.readFile(textPath, 'utf-8');
    } catch {
      // Text version is optional
    }

    this.compileTemplate({ name: templateName, subject: subject.trim(), html, text });
  }

  /**
   * Load all templates from a directory
   */
  async loadTemplatesFromDirectory(templatesPath: string): Promise<void> {
    try {
      const files = await fs.readdir(templatesPath);
      const htmlFiles = files.filter(f => f.endsWith('.html'));

      for (const file of htmlFiles) {
        const templateName = path.basename(file, '.html');
        try {
          await this.loadTemplate(templatesPath, templateName);
        } catch (error) {
          this.logger.warn(`Failed to load template ${templateName}: ${error}`);
        }
      }
    } catch (error) {
      this.logger.warn(`Could not load templates from ${templatesPath}: ${error}`);
    }
  }

  /**
   * Render a template with context
   */
  render(templateName: string, context: Record<string, unknown>): {
    subject: string;
    html: string;
    text?: string;
  } {
    const template = this.compiledTemplates.get(templateName);

    if (!template) {
      throw new Error(`Email template not found: ${templateName}`);
    }

    return {
      subject: template.subject(context),
      html: template.html(context),
      text: template.text ? template.text(context) : undefined,
    };
  }

  /**
   * Render a template string directly
   */
  renderString(templateString: string, context: Record<string, unknown>): string {
    const compiled = this.handlebars.compile(templateString);
    return compiled(context);
  }

  /**
   * Check if a template exists
   */
  hasTemplate(templateName: string): boolean {
    return this.compiledTemplates.has(templateName);
  }

  /**
   * Get list of available templates
   */
  getAvailableTemplates(): string[] {
    return Array.from(this.compiledTemplates.keys());
  }

  /**
   * Clear the template cache
   */
  clearCache(): void {
    this.compiledTemplates.clear();
    this.logger.debug('Email template cache cleared');
  }

  /**
   * Create a base email layout wrapper
   */
  wrapWithLayout(bodyHtml: string, context: Record<string, unknown>): string {
    const layoutTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #334155;
      background-color: #f1f5f9;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .email-body {
      padding: 30px;
    }
    a {
      color: #3b82f6;
    }
    .btn {
      display: inline-block;
      padding: 12px 24px;
      background-color: #3b82f6;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 500;
    }
    .btn:hover {
      background-color: #2563eb;
    }
  </style>
</head>
<body>
  <div class="email-container">
    {{> emailHeader}}
    <div class="email-body">
      {{{body}}}
    </div>
    {{> emailFooter}}
  </div>
</body>
</html>
    `;

    const compiled = this.handlebars.compile(layoutTemplate);
    return compiled({ ...context, body: bodyHtml });
  }
}
