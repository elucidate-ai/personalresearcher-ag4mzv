/**
 * Export Types and Interfaces
 * Version: 1.0.0
 * 
 * Defines comprehensive TypeScript interfaces and types for enterprise-grade export functionality,
 * including format specifications, validation, progress tracking, and security features.
 */

import { ApiResponse } from './api.types';
import { Content } from './content.types';

/**
 * Supported export formats with const assertions for type safety
 */
export const ExportFormat = {
  MARKDOWN: 'MARKDOWN',
  PDF: 'PDF',
  NOTION: 'NOTION'
} as const;

export type ExportFormat = typeof ExportFormat[keyof typeof ExportFormat];

/**
 * Type-safe export identifier using branded types
 */
export type ExportId = string & { readonly __brand: unique symbol };

/**
 * Markdown-specific export options
 */
export interface MarkdownOptions {
  readonly flavor: 'CommonMark' | 'GitHub' | 'GitLab';
  readonly includeTableOfContents: boolean;
  readonly includeMetadata: boolean;
  readonly frontMatterFormat: 'YAML' | 'TOML';
  readonly lineWidth: number;
}

/**
 * PDF-specific export options
 */
export interface PDFOptions {
  readonly pageSize: 'A4' | 'Letter' | 'Legal';
  readonly orientation: 'portrait' | 'landscape';
  readonly margins: {
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
  };
  readonly includeHeaderFooter: boolean;
  readonly includePageNumbers: boolean;
  readonly fontFamily: string;
  readonly fontSize: number;
}

/**
 * Notion-specific export options
 */
export interface NotionOptions {
  readonly databaseId?: string;
  readonly parentPageId?: string;
  readonly createIndex: boolean;
  readonly includeBacklinks: boolean;
  readonly preserveFormatting: boolean;
  readonly syncUpdates: boolean;
}

/**
 * Format-specific export options union
 */
export interface ExportFormatOptions {
  readonly markdown?: MarkdownOptions;
  readonly pdf?: PDFOptions;
  readonly notion?: NotionOptions;
}

/**
 * Export metadata for tracking and organization
 */
export interface ExportMetadata {
  readonly createdBy: string;
  readonly createdAt: string;
  readonly tags: readonly string[];
  readonly category?: string;
  readonly description?: string;
  readonly version: string;
}

/**
 * Enhanced interface for export configuration options
 */
export interface ExportOptions {
  readonly format: ExportFormat;
  readonly contentIds: readonly string[];
  readonly title: string;
  readonly includeGraphs: boolean;
  readonly includeReferences: boolean;
  readonly formatOptions: ExportFormatOptions;
  readonly metadata: ExportMetadata;
}

/**
 * Export status enum
 */
export enum ExportStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED'
}

/**
 * Export error codes enum
 */
export enum ExportErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PROCESSING_ERROR = 'PROCESSING_ERROR',
  FORMAT_ERROR = 'FORMAT_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  RESOURCE_ERROR = 'RESOURCE_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR'
}

/**
 * Export stage interface for granular progress tracking
 */
export interface ExportStage {
  readonly name: string;
  readonly status: ExportStatus;
  readonly progress: number;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly error?: ExportError;
}

/**
 * Structured export error information
 */
export interface ExportError {
  readonly code: ExportErrorCode;
  readonly message: string;
  readonly details: Record<string, unknown>;
}

/**
 * Enhanced interface for detailed export progress tracking
 */
export interface ExportProgress {
  readonly exportId: ExportId;
  readonly status: ExportStatus;
  readonly progress: number;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly canceledAt: string | null;
  readonly error: ExportError | null;
  readonly retryCount: number;
  readonly stages: ExportStage[];
}

/**
 * Enhanced interface for export result with security and metadata
 */
export interface ExportResult {
  readonly exportId: ExportId;
  readonly format: ExportFormat;
  readonly url: string;
  readonly expiresAt: string;
  readonly fileSize: number;
  readonly checksum: string;
  readonly metadata: ExportMetadata;
  readonly securityHeaders: Record<string, string>;
}

/**
 * Type for export API response
 */
export type ExportResponse = ApiResponse<ExportResult>;

/**
 * Type for export progress API response
 */
export type ExportProgressResponse = ApiResponse<ExportProgress>;

/**
 * Type guard for checking if an object is a valid ExportResult
 */
export function isExportResult(obj: unknown): obj is ExportResult {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'exportId' in obj &&
    'format' in obj &&
    'url' in obj &&
    'metadata' in obj
  );
}

/**
 * Type guard for checking if an object is a valid ExportProgress
 */
export function isExportProgress(obj: unknown): obj is ExportProgress {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'exportId' in obj &&
    'status' in obj &&
    'progress' in obj &&
    'stages' in obj
  );
}

/**
 * Default export format options
 */
export const DEFAULT_EXPORT_OPTIONS: Partial<ExportOptions> = {
  includeGraphs: true,
  includeReferences: true,
  formatOptions: {
    markdown: {
      flavor: 'GitHub',
      includeTableOfContents: true,
      includeMetadata: true,
      frontMatterFormat: 'YAML',
      lineWidth: 80
    }
  }
};