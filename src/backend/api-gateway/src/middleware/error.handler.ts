import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import { StatusCodes } from 'http-status-codes'; // ^2.3.0
import { logError, ErrorMetrics } from '../utils/logger';
import { ApiResponse, ErrorType } from '../types';
import * as grpc from '@grpc/grpc-js'; // ^1.9.0

/**
 * Custom API Error class with enhanced tracking capabilities
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly correlationId: string;
  public readonly timestamp: Date;
  public readonly metadata: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
    code: string = ErrorType.SERVICE_ERROR,
    metadata: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.correlationId = metadata.correlationId as string || generateCorrelationId();
    this.timestamp = new Date();
    this.metadata = metadata;
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
    
    // Freeze error instance for immutability
    Object.freeze(this);
  }
}

/**
 * Maps gRPC status codes to HTTP status codes
 */
const grpcToHttpStatus = new Map<number, number>([
  [grpc.status.INVALID_ARGUMENT, StatusCodes.BAD_REQUEST],
  [grpc.status.FAILED_PRECONDITION, StatusCodes.BAD_REQUEST],
  [grpc.status.OUT_OF_RANGE, StatusCodes.BAD_REQUEST],
  [grpc.status.UNAUTHENTICATED, StatusCodes.UNAUTHORIZED],
  [grpc.status.PERMISSION_DENIED, StatusCodes.FORBIDDEN],
  [grpc.status.NOT_FOUND, StatusCodes.NOT_FOUND],
  [grpc.status.ALREADY_EXISTS, StatusCodes.CONFLICT],
  [grpc.status.RESOURCE_EXHAUSTED, StatusCodes.TOO_MANY_REQUESTS],
  [grpc.status.DEADLINE_EXCEEDED, StatusCodes.GATEWAY_TIMEOUT],
  [grpc.status.UNAVAILABLE, StatusCodes.SERVICE_UNAVAILABLE],
  [grpc.status.INTERNAL, StatusCodes.INTERNAL_SERVER_ERROR]
]);

/**
 * Generates a unique correlation ID for error tracking
 */
function generateCorrelationId(): string {
  return `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Determines appropriate HTTP status code based on error type
 */
function getStatusCode(error: Error | ApiError | grpc.ServiceError): number {
  if (error instanceof ApiError) {
    return error.statusCode;
  }

  if ('code' in error && typeof error.code === 'number') {
    return grpcToHttpStatus.get(error.code) || StatusCodes.INTERNAL_SERVER_ERROR;
  }

  switch (error.name) {
    case 'ValidationError':
      return StatusCodes.BAD_REQUEST;
    case 'UnauthorizedError':
      return StatusCodes.UNAUTHORIZED;
    case 'ForbiddenError':
      return StatusCodes.FORBIDDEN;
    case 'NotFoundError':
      return StatusCodes.NOT_FOUND;
    case 'ConflictError':
      return StatusCodes.CONFLICT;
    case 'TimeoutError':
      return StatusCodes.GATEWAY_TIMEOUT;
    default:
      return StatusCodes.INTERNAL_SERVER_ERROR;
  }
}

/**
 * Sanitizes error message to prevent sensitive information disclosure
 */
function sanitizeErrorMessage(error: Error): string {
  // Use a generic message in production for 500 errors
  if (process.env.NODE_ENV === 'production' && 
      (error instanceof ApiError && error.statusCode === StatusCodes.INTERNAL_SERVER_ERROR)) {
    return 'An internal server error occurred';
  }
  return error.message;
}

/**
 * Express error handling middleware
 */
export function errorHandler(
  error: Error | ApiError | grpc.ServiceError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Extract or generate correlation ID
  const correlationId = (error instanceof ApiError) 
    ? error.correlationId 
    : (req.headers['x-correlation-id'] as string || generateCorrelationId());

  // Determine status code
  const statusCode = getStatusCode(error);

  // Prepare error metadata
  const errorMetadata = {
    correlationId,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    ...(error instanceof ApiError ? error.metadata : {}),
  };

  // Log error with correlation ID
  logError(error, correlationId, errorMetadata);

  // Update error metrics
  ErrorMetrics.increment(statusCode, error.name);

  // Prepare rate limit headers if applicable
  const rateLimit = {
    remaining: res.getHeader('X-RateLimit-Remaining'),
    reset: res.getHeader('X-RateLimit-Reset'),
  };

  // Construct API response
  const response: ApiResponse = {
    success: false,
    error: sanitizeErrorMessage(error),
    metadata: {
      correlationId,
      code: error instanceof ApiError ? error.code : ErrorType.SERVICE_ERROR,
      ...(rateLimit.remaining && { rateLimit }),
    },
  };

  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Correlation-ID', correlationId);

  // Send error response
  res.status(statusCode).json(response);
}

/**
 * Wraps async route handlers to catch unhandled promise rejections
 */
export function asyncErrorHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Export error types for consistent error handling across the application
export { ErrorType };