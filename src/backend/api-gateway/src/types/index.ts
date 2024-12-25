// @grpc/grpc-js v1.9.0 - gRPC runtime for Node.js
import * as grpc from '@grpc/grpc-js';

// Import gRPC service definitions from proto files
import { ContentService, Content } from '../grpc/proto/content.proto';
import { KnowledgeService, Graph } from '../grpc/proto/knowledge.proto';
import { OutputService, ExportFormat } from '../grpc/proto/output.proto';
import { VectorService, EmbeddingResponse } from '../grpc/proto/vector.proto';

/**
 * Interface defining all gRPC client instances used across the API Gateway
 */
export interface GrpcClients {
  content: ContentService;
  knowledge: KnowledgeService;
  output: OutputService;
  vector: VectorService;
}

/**
 * Core topic entity interface
 */
export interface Topic {
  id: string;
  name: string;
  metadata: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Enum for all supported content types in the system
 */
export enum ContentType {
  VIDEO = 'VIDEO',
  ARTICLE = 'ARTICLE',
  PODCAST = 'PODCAST',
  BOOK = 'BOOK',
  RESEARCH_PAPER = 'RESEARCH_PAPER',
  BLOG_POST = 'BLOG_POST',
  COURSE = 'COURSE',
  PRESENTATION = 'PRESENTATION'
}

/**
 * Enum for supported export formats
 */
export enum ExportFormat {
  NOTION = 'NOTION',
  MARKDOWN = 'MARKDOWN',
  PDF = 'PDF'
}

/**
 * Generic API response wrapper with type safety
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Search request parameters for vector operations
 */
export interface SearchRequest {
  query: string;
  contentTypes?: ContentType[];
  filters?: {
    minQualityScore?: number;
    maxResults?: number;
    language?: string;
    publishedAfter?: Date;
    publishedBefore?: Date;
    excludedSources?: string[];
  };
  metadata?: Record<string, any>;
}

/**
 * Knowledge graph request parameters
 */
export interface GraphRequest {
  topicId: string;
  depth?: number;
  options?: {
    includeMetadata?: boolean;
    metricNames?: string[];
    validationRules?: string[];
  };
  metadata?: Record<string, any>;
}

/**
 * Document export request parameters
 */
export interface ExportRequest {
  topicId: string;
  format: ExportFormat;
  options?: {
    includeGraphs?: boolean;
    includeReferences?: boolean;
    customStyles?: Record<string, string>;
    sectionsToInclude?: string[];
    maxDepth?: number;
    templateId?: string;
  };
  metadata?: Record<string, any>;
}

/**
 * Error types for consistent error handling
 */
export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  SERVICE_ERROR = 'SERVICE_ERROR',
  TIMEOUT = 'TIMEOUT'
}

/**
 * Custom error interface for API errors
 */
export interface ApiError extends Error {
  type: ErrorType;
  code: number;
  metadata?: Record<string, any>;
}

/**
 * Interface for service health check responses
 */
export interface HealthCheckResponse {
  service: string;
  status: 'UP' | 'DOWN' | 'DEGRADED';
  timestamp: Date;
  details?: Record<string, any>;
}

/**
 * Interface for pagination parameters
 */
export interface PaginationParams {
  pageSize?: number;
  pageToken?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Interface for audit log entries
 */
export interface AuditLogEntry {
  timestamp: Date;
  userId: string;
  action: string;
  resource: string;
  details: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Type for gRPC deadline options
 */
export type GrpcDeadline = number | Date | string;

/**
 * Interface for gRPC call options
 */
export interface GrpcCallOptions extends grpc.CallOptions {
  deadline?: GrpcDeadline;
  propagateCancel?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Type guard for checking ExportFormat
 */
export function isExportFormat(format: string): format is ExportFormat {
  return Object.values(ExportFormat).includes(format as ExportFormat);
}

/**
 * Type guard for checking ContentType
 */
export function isContentType(type: string): type is ContentType {
  return Object.values(ContentType).includes(type as ContentType);
}