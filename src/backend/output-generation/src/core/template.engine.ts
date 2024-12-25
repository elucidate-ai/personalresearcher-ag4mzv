/**
 * @fileoverview Core template engine for managing document template selection,
 * initialization and content rendering across different export formats
 * @version 1.0.0
 */

import { Document, DocumentContent, ExportFormat } from '../models/document.model';
import generateMarkdown from '../templates/markdown.template';
import NotionTemplate from '../templates/notion.template';
import PDFTemplate from '../templates/pdf.template';

/**
 * Configuration options for template generation with enhanced customization
 */
interface AccessibilityOptions {
  pdfUA: boolean;
  language: string;
  documentRole: string;
  structureTypes: boolean;
}

interface TemplateOptions {
  format: ExportFormat;
  includeGraphs: boolean;
  customStyles: Record<string, string>;
  locale: string;
  accessibility: AccessibilityOptions;
}

/**
 * Core template engine that manages document template selection,
 * initialization and content rendering with enhanced memory management
 */
export class TemplateEngine {
  private _document: Document;
  private _options: TemplateOptions;
  private _templateCache: Map<ExportFormat, Function>;
  private readonly DEFAULT_OPTIONS: Partial<TemplateOptions> = {
    includeGraphs: true,
    customStyles: {},
    locale: 'en-US',
    accessibility: {
      pdfUA: true,
      language: 'en-US',
      documentRole: 'Document',
      structureTypes: true
    }
  };

  /**
   * Initializes template engine with document validation and options
   * @param document Document instance to process
   * @param options Template generation options
   */
  constructor(document: Document, options: Partial<TemplateOptions>) {
    if (!document) {
      throw new Error('Document instance is required');
    }

    // Validate document content integrity
    const validation = document.validate();
    if (!validation.isValid) {
      throw new Error(`Invalid document content: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    this._document = document;
    this._options = {
      ...this.DEFAULT_OPTIONS,
      ...options,
      format: options.format || ExportFormat.MARKDOWN
    } as TemplateOptions;

    this._templateCache = new Map();
    this.validateFormatCompatibility();
  }

  /**
   * Generates document output in specified format with error handling
   * @returns Promise resolving to generated document content
   */
  public async generateOutput(): Promise<Buffer | string> {
    try {
      const template = await this._selectTemplate(this._options.format);
      const content = this._document.getContent();

      // Apply format-specific processing
      switch (this._options.format) {
        case ExportFormat.MARKDOWN:
          return template(content);

        case ExportFormat.NOTION:
          const notionBlocks = await template.convertToNotion(content);
          return JSON.stringify(notionBlocks);

        case ExportFormat.PDF:
          const pdfBuffer = await template.generatePDF();
          return pdfBuffer;

        default:
          throw new Error(`Unsupported export format: ${this._options.format}`);
      }
    } catch (error) {
      console.error('Error generating document output:', error);
      throw new Error(`Failed to generate ${this._options.format} output: ${error.message}`);
    } finally {
      // Cleanup resources
      if (this._options.format === ExportFormat.PDF) {
        global.gc?.();
      }
    }
  }

  /**
   * Updates template options with validation
   * @param options New template options
   */
  public updateOptions(options: Partial<TemplateOptions>): void {
    const newOptions = {
      ...this._options,
      ...options
    };

    // Validate format compatibility if changed
    if (options.format && options.format !== this._options.format) {
      this.validateFormatCompatibility(options.format);
    }

    this._options = newOptions;

    // Clear cached template if format changed
    if (options.format) {
      this._templateCache.delete(this._options.format);
    }
  }

  /**
   * Selects and initializes appropriate template based on format
   * @param format Export format to use
   * @returns Template generator function or instance
   */
  private async _selectTemplate(format: ExportFormat): Promise<any> {
    // Check template cache first
    if (this._templateCache.has(format)) {
      return this._templateCache.get(format);
    }

    let template;
    switch (format) {
      case ExportFormat.MARKDOWN:
        template = generateMarkdown;
        break;

      case ExportFormat.NOTION:
        template = new NotionTemplate();
        break;

      case ExportFormat.PDF:
        template = new PDFTemplate(this._document.getContent(), {
          pageSize: 'A4',
          margins: {
            top: 72,
            right: 72,
            bottom: 72,
            left: 72
          },
          fonts: {},
          includeGraphs: this._options.includeGraphs,
          accessibility: this._options.accessibility,
          compression: {
            useCompression: true,
            compressionLevel: 6
          }
        });
        break;

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    // Cache the template
    this._templateCache.set(format, template);
    return template;
  }

  /**
   * Validates format compatibility and requirements
   * @param format Optional format to validate
   */
  private validateFormatCompatibility(format?: ExportFormat): void {
    const targetFormat = format || this._options.format;
    const content = this._document.getContent();

    switch (targetFormat) {
      case ExportFormat.PDF:
        // Validate content size for PDF generation
        const contentSize = JSON.stringify(content).length;
        if (contentSize > 10 * 1024 * 1024) { // 10MB limit
          throw new Error('Content size exceeds PDF generation limit');
        }
        break;

      case ExportFormat.NOTION:
        // Validate Notion block limits
        if (content.sections.length > 100) {
          throw new Error('Section count exceeds Notion block limit');
        }
        break;

      case ExportFormat.MARKDOWN:
        // Validate markdown compatibility
        if (content.graphs.length > 0 && !this._options.includeGraphs) {
          console.warn('Graphs will be excluded from Markdown output');
        }
        break;
    }
  }
}

export default TemplateEngine;