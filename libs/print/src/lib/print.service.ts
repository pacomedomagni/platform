import { Injectable, Inject, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  PrintModuleOptions,
  PRINT_MODULE_OPTIONS,
  PdfOptions,
  PrintFormatDefinition,
  RenderContext,
  GeneratePdfResult,
} from './print.types';
import { TemplateService } from './template.service';

@Injectable()
export class PrintService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrintService.name);
  private browser: puppeteer.Browser | null = null;
  private printFormats: Map<string, PrintFormatDefinition> = new Map();

  constructor(
    @Inject(PRINT_MODULE_OPTIONS) private readonly options: PrintModuleOptions,
    private readonly templateService: TemplateService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.launchBrowser();
    await this.loadBuiltInTemplates();
    this.logger.log('Print service initialized');
  }

  async onModuleDestroy(): Promise<void> {
    await this.closeBrowser();
  }

  private async launchBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
      this.logger.debug('Puppeteer browser launched');
    }
  }

  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.logger.debug('Puppeteer browser closed');
    }
  }

  private async loadBuiltInTemplates(): Promise<void> {
    // Load partials if they exist
    const partialsPath = path.join(this.options.templatesPath, 'partials');
    try {
      await fs.access(partialsPath);
      await this.templateService.registerPartialsFromDirectory(partialsPath);
    } catch {
      // Partials directory doesn't exist
    }
  }

  /**
   * Register a print format
   */
  registerPrintFormat(format: PrintFormatDefinition): void {
    const key = `${format.doctype}:${format.name}`;
    this.printFormats.set(key, format);
    this.logger.debug(`Registered print format: ${key}`);
  }

  /**
   * Get a print format
   */
  getPrintFormat(doctype: string, formatName?: string): PrintFormatDefinition | undefined {
    if (formatName) {
      return this.printFormats.get(`${doctype}:${formatName}`);
    }

    // Get default format for doctype
    for (const [key, format] of this.printFormats) {
      if (key.startsWith(`${doctype}:`) && format.isDefault) {
        return format;
      }
    }

    // Get any format for doctype
    for (const [key, format] of this.printFormats) {
      if (key.startsWith(`${doctype}:`)) {
        return format;
      }
    }

    return undefined;
  }

  /**
   * Generate PDF from HTML string
   */
  async generatePdfFromHtml(html: string, options?: PdfOptions): Promise<Buffer> {
    await this.launchBrowser();

    const page = await this.browser!.newPage();

    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfOptions: puppeteer.PDFOptions = {
        format: options?.format || this.options.defaultOptions?.format || 'A4',
        landscape: options?.landscape || this.options.defaultOptions?.landscape || false,
        printBackground: options?.printBackground ?? this.options.defaultOptions?.printBackground ?? true,
        scale: options?.scale || this.options.defaultOptions?.scale || 1,
        margin: options?.margin || this.options.defaultOptions?.margin || {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
        displayHeaderFooter: options?.displayHeaderFooter ?? false,
        headerTemplate: options?.headerTemplate || '',
        footerTemplate: options?.footerTemplate || '',
        preferCSSPageSize: options?.preferCSSPageSize ?? false,
      };

      const pdfBuffer = await page.pdf(pdfOptions);
      return Buffer.from(pdfBuffer);
    } finally {
      await page.close();
    }
  }

  /**
   * Generate PDF from a template file
   */
  async generatePdfFromTemplate(
    templateName: string,
    context: RenderContext,
    options?: PdfOptions,
  ): Promise<GeneratePdfResult> {
    const templatePath = path.join(this.options.templatesPath, `${templateName}.hbs`);

    let template;
    try {
      template = await this.templateService.loadTemplate(templatePath, this.options.cacheTemplates ?? true);
    } catch (error) {
      // Try .html extension
      const htmlPath = path.join(this.options.templatesPath, `${templateName}.html`);
      template = await this.templateService.loadTemplate(htmlPath, this.options.cacheTemplates ?? true);
    }

    const html = this.templateService.render(template, context);
    const buffer = await this.generatePdfFromHtml(html, options);

    return {
      buffer,
      pages: await this.countPages(buffer),
      filename: this.generateFilename(context.doctype, context.docname),
    };
  }

  /**
   * Generate PDF for a document using its registered print format
   */
  async generateDocumentPdf(
    doctype: string,
    doc: Record<string, unknown>,
    formatName?: string,
    additionalContext?: Partial<RenderContext>,
  ): Promise<GeneratePdfResult> {
    const format = this.getPrintFormat(doctype, formatName);

    if (!format) {
      throw new Error(`No print format found for doctype: ${doctype}`);
    }

    const now = new Date();
    const context: RenderContext = {
      doc,
      doctype,
      docname: String(doc['name'] || doc['id'] || 'document'),
      printDate: now.toLocaleDateString(),
      printTime: now.toLocaleTimeString(),
      ...additionalContext,
    };

    // If format has inline template, use it
    if (format.template.includes('{{') || format.template.includes('<')) {
      const html = this.buildFullHtml(format, context);
      const buffer = await this.generatePdfFromHtml(html, format.options);
      return {
        buffer,
        pages: await this.countPages(buffer),
        filename: this.generateFilename(doctype, context.docname),
      };
    }

    // Otherwise, treat as template name
    return this.generatePdfFromTemplate(format.template, context, format.options);
  }

  /**
   * Build full HTML document from format definition
   */
  private buildFullHtml(format: PrintFormatDefinition, context: RenderContext): string {
    const bodyHtml = this.templateService.renderString(format.template, context);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${context.doctype} - ${context.docname}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #333;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 8px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background-color: #f5f5f5;
      font-weight: 600;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .font-bold {
      font-weight: 600;
    }
    .text-lg {
      font-size: 1.125rem;
    }
    .text-xl {
      font-size: 1.25rem;
    }
    .text-2xl {
      font-size: 1.5rem;
    }
    .mb-4 {
      margin-bottom: 1rem;
    }
    .mb-8 {
      margin-bottom: 2rem;
    }
    .mt-4 {
      margin-top: 1rem;
    }
    .mt-8 {
      margin-top: 2rem;
    }
    .p-4 {
      padding: 1rem;
    }
    .border {
      border: 1px solid #ddd;
    }
    .border-t {
      border-top: 1px solid #ddd;
    }
    .border-b {
      border-bottom: 1px solid #ddd;
    }
    .grid {
      display: grid;
    }
    .grid-cols-2 {
      grid-template-columns: repeat(2, 1fr);
    }
    .gap-4 {
      gap: 1rem;
    }
    .flex {
      display: flex;
    }
    .justify-between {
      justify-content: space-between;
    }
    .items-center {
      align-items: center;
    }
    @media print {
      @page {
        margin: 0;
      }
      body {
        margin: 20mm 15mm;
      }
    }
    ${format.css || ''}
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
  }

  /**
   * Count pages in a PDF buffer
   */
  private async countPages(pdfBuffer: Buffer): Promise<number> {
    // Simple page count by looking for /Type /Page in PDF
    const content = pdfBuffer.toString('binary');
    const matches = content.match(/\/Type\s*\/Page[^s]/g);
    return matches ? matches.length : 1;
  }

  /**
   * Generate a filename for the PDF
   */
  private generateFilename(doctype: string, docname: string): string {
    const sanitizedDoctype = doctype.replace(/\s+/g, '-').toLowerCase();
    const sanitizedDocname = docname.replace(/[^a-zA-Z0-9-]/g, '_');
    return `${sanitizedDoctype}_${sanitizedDocname}.pdf`;
  }

  /**
   * Generate PDF and save to file
   */
  async generatePdfToFile(
    templateName: string,
    context: RenderContext,
    outputPath: string,
    options?: PdfOptions,
  ): Promise<GeneratePdfResult> {
    const result = await this.generatePdfFromTemplate(templateName, context, options);
    await fs.writeFile(outputPath, result.buffer);
    return result;
  }

  /**
   * Preview HTML (for debugging templates)
   */
  async previewHtml(
    templateName: string,
    context: RenderContext,
  ): Promise<string> {
    const templatePath = path.join(this.options.templatesPath, `${templateName}.hbs`);
    const template = await this.templateService.loadTemplate(templatePath, false);
    return this.templateService.render(template, context);
  }

  /**
   * Generate multiple PDFs and merge them
   */
  async generateBulkPdf(
    items: Array<{ templateName: string; context: RenderContext }>,
    options?: PdfOptions,
  ): Promise<Buffer[]> {
    const results: Buffer[] = [];

    for (const item of items) {
      const result = await this.generatePdfFromTemplate(item.templateName, item.context, options);
      results.push(result.buffer);
    }

    return results;
  }
}
