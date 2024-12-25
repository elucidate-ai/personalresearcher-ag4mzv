/**
 * @fileoverview Enterprise-grade document generator service with optimized performance,
 * memory management, and comprehensive lifecycle tracking
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { Document, DocumentContent, ExportFormat } from '../models/document.model';
import TemplateEngine from './template.engine';
import FormatConverter from './format.converter';

/**
 * Configuration options for document generation with enterprise features
 */
export interface GeneratorOptions {
  format: ExportFormat;
  includeGraphs: boolean;
  templateOptions: {
    customStyles?: Record<string, string>;
    locale?: string;
    timezone?: string;
  };
  formatOptions: {
    compression?: {
      enabled: boolean;
      level: number;
      method: 'fast' | 'balanced' | 'maximum';
    };
    accessibility?: {
      enabled: boolean;
      wcagLevel: 'A' | 'AA' | 'AAA';
      language: string;
    };
  };
  memoryOptimization: {
    chunkSize: number;
    gcThreshold: number;
    maxBufferSize: number;
  };
  progressTracking: {
    enabled: boolean;
    granularity: number;
    includeMetrics: boolean;
  };
}

/**
 * Result of document generation process with detailed metrics
 */
export interface GenerationResult {
  content: string | Buffer;
  format: ExportFormat;
  metadata: {
    generatedAt: Date;
    contentSize: number;
    pageCount?: number;
    graphCount?: number;
  };
  metrics: {
    totalDuration: number;
    templateDuration: number;
    conversionDuration: number;
    memoryUsage: {
      initial: number;
      peak: number;
      final: number;
    };
  };
}

/**
 * Memory management utility for optimized document generation
 */
class MemoryManager {
  private currentUsage: number = 0;
  private peakUsage: number = 0;
  private readonly gcThreshold: number;

  constructor(gcThreshold: number) {
    this.gcThreshold = gcThreshold;
  }

  public trackMemory(size: number): void {
    this.currentUsage += size;
    this.peakUsage = Math.max(this.peakUsage, this.currentUsage);

    if (this.currentUsage > this.gcThreshold) {
      this.triggerGC();
    }
  }

  public getMetrics(): { current: number; peak: number } {
    return {
      current: this.currentUsage,
      peak: this.peakUsage
    };
  }

  private triggerGC(): void {
    if (global.gc) {
      global.gc();
      this.currentUsage = 0;
    }
  }
}

/**
 * Progress tracking utility for generation lifecycle
 */
class ProgressTracker {
  private progress: number = 0;
  private readonly granularity: number;
  private readonly eventEmitter: EventEmitter;

  constructor(granularity: number, eventEmitter: EventEmitter) {
    this.granularity = granularity;
    this.eventEmitter = eventEmitter;
  }

  public updateProgress(percentage: number): void {
    const normalizedProgress = Math.floor(percentage / this.granularity) * this.granularity;
    if (normalizedProgress !== this.progress) {
      this.progress = normalizedProgress;
      this.eventEmitter.emit('progress', this.progress);
    }
  }

  public reset(): void {
    this.progress = 0;
  }
}

/**
 * Enterprise-grade document generator with comprehensive lifecycle management
 * and performance optimization
 */
export class DocumentGenerator {
  private readonly _document: Document;
  private readonly _templateEngine: TemplateEngine;
  private readonly _formatConverter: FormatConverter;
  private readonly _options: GeneratorOptions;
  private readonly _eventEmitter: EventEmitter;
  private readonly _memoryManager: MemoryManager;
  private readonly _progressTracker: ProgressTracker;

  /**
   * Initializes document generator with enhanced performance monitoring
   */
  constructor(content: DocumentContent, options: GeneratorOptions) {
    // Validate inputs
    if (!content || !options) {
      throw new Error('Invalid content or options provided');
    }

    // Initialize core components
    this._document = new Document(content, options.format);
    this._options = this.normalizeOptions(options);
    this._eventEmitter = new EventEmitter();
    this._memoryManager = new MemoryManager(options.memoryOptimization.gcThreshold);
    this._progressTracker = new ProgressTracker(
      options.progressTracking.granularity,
      this._eventEmitter
    );

    // Initialize engines with optimized configuration
    this._templateEngine = new TemplateEngine(this._document, {
      format: options.format,
      includeGraphs: options.includeGraphs,
      customStyles: options.templateOptions.customStyles,
      locale: options.templateOptions.locale
    });

    this._formatConverter = new FormatConverter(this._document, {
      includeGraphs: options.includeGraphs,
      compression: options.formatOptions.compression,
      accessibility: options.formatOptions.accessibility
    });

    // Register cleanup handlers
    process.on('beforeExit', () => this.cleanup());
  }

  /**
   * Generates document with progress tracking and memory optimization
   */
  public async generate(): Promise<GenerationResult> {
    const startTime = Date.now();
    const initialMemory = process.memoryUsage().heapUsed;

    try {
      // Validate content and configuration
      if (!this._validateContent()) {
        throw new Error('Document content validation failed');
      }

      this._progressTracker.reset();
      this._eventEmitter.emit('generation:start');

      // Generate template with progress tracking
      this._progressTracker.updateProgress(10);
      const templateStart = Date.now();
      await this._templateEngine.generateOutput();
      const templateDuration = Date.now() - templateStart;

      // Convert to target format with memory optimization
      this._progressTracker.updateProgress(50);
      const conversionStart = Date.now();
      const content = await this._formatConverter.convert(this._options.format);
      const conversionDuration = Date.now() - conversionStart;

      // Track final memory metrics
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryMetrics = this._memoryManager.getMetrics();

      this._progressTracker.updateProgress(100);
      this._eventEmitter.emit('generation:complete');

      // Generate comprehensive result
      return {
        content,
        format: this._options.format,
        metadata: this._generateMetadata(),
        metrics: {
          totalDuration: Date.now() - startTime,
          templateDuration,
          conversionDuration,
          memoryUsage: {
            initial: initialMemory,
            peak: memoryMetrics.peak,
            final: finalMemory
          }
        }
      };

    } catch (error) {
      this._eventEmitter.emit('generation:error', error);
      throw new Error(`Document generation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Updates generator options with validation
   */
  public updateOptions(options: Partial<GeneratorOptions>): void {
    this._options.templateOptions = {
      ...this._options.templateOptions,
      ...options.templateOptions
    };

    this._options.formatOptions = {
      ...this._options.formatOptions,
      ...options.formatOptions
    };

    this._templateEngine.updateOptions({
      format: options.format || this._options.format,
      includeGraphs: options.includeGraphs ?? this._options.includeGraphs
    });

    this._eventEmitter.emit('options:updated', this._options);
  }

  /**
   * Validates document content with enhanced checks
   */
  private _validateContent(): boolean {
    const validation = this._document.validate();
    
    if (!validation.isValid) {
      this._eventEmitter.emit('validation:failed', validation.errors);
      return false;
    }

    if (validation.warnings.length > 0) {
      this._eventEmitter.emit('validation:warnings', validation.warnings);
    }

    return true;
  }

  /**
   * Generates comprehensive metadata for the generation process
   */
  private _generateMetadata(): GenerationResult['metadata'] {
    const content = this._document.getContent();
    
    return {
      generatedAt: new Date(),
      contentSize: JSON.stringify(content).length,
      pageCount: this._estimatePageCount(content),
      graphCount: content.graphs?.length || 0
    };
  }

  /**
   * Normalizes and validates generator options
   */
  private normalizeOptions(options: GeneratorOptions): GeneratorOptions {
    return {
      format: options.format,
      includeGraphs: options.includeGraphs ?? true,
      templateOptions: {
        customStyles: options.templateOptions?.customStyles || {},
        locale: options.templateOptions?.locale || 'en-US',
        timezone: options.templateOptions?.timezone || 'UTC'
      },
      formatOptions: {
        compression: {
          enabled: true,
          level: 6,
          method: 'balanced',
          ...options.formatOptions?.compression
        },
        accessibility: {
          enabled: true,
          wcagLevel: 'AA',
          language: 'en',
          ...options.formatOptions?.accessibility
        }
      },
      memoryOptimization: {
        chunkSize: 1024 * 1024, // 1MB
        gcThreshold: 100 * 1024 * 1024, // 100MB
        maxBufferSize: 500 * 1024 * 1024, // 500MB
        ...options.memoryOptimization
      },
      progressTracking: {
        enabled: true,
        granularity: 5,
        includeMetrics: true,
        ...options.progressTracking
      }
    };
  }

  /**
   * Estimates page count based on content size and format
   */
  private _estimatePageCount(content: DocumentContent): number {
    const avgCharsPerPage = this._options.format === ExportFormat.PDF ? 3000 : 5000;
    const totalChars = JSON.stringify(content).length;
    return Math.ceil(totalChars / avgCharsPerPage);
  }

  /**
   * Performs cleanup operations
   */
  private cleanup(): void {
    this._memoryManager.trackMemory(0);
    this._eventEmitter.removeAllListeners();
  }
}

export default DocumentGenerator;