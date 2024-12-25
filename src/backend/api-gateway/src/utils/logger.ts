import winston, { format, Logger, transports } from 'winston'; // ^3.11.0
import * as Sentry from '@sentry/node'; // ^7.0.0
import { env, logging } from '../config/config';
import os from 'os';
import path from 'path';

// Define log levels with corresponding priorities
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Initialize Sentry for error tracking if DSN is provided
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: env,
    tracesSampleRate: env === 'production' ? 0.1 : 1.0,
    beforeSend(event) {
      // Mask sensitive data before sending to Sentry
      return maskSensitiveData(event);
    },
  });
}

// Custom format for adding metadata to logs
const metadataFormat = format.metadata({
  fillWith: {
    service: 'api-gateway',
    environment: env,
    hostname: os.hostname(),
    pid: process.pid,
    version: process.env.npm_package_version || 'unknown',
  },
});

// Format for masking sensitive data
const maskFormat = format((info) => {
  info.message = maskSensitiveData(info.message);
  return info;
});

/**
 * Masks sensitive information in log messages
 * @param message - The message to mask sensitive data from
 * @returns The masked message
 */
function maskSensitiveData(message: any): any {
  if (typeof message !== 'object') {
    return message;
  }

  const maskedMessage = { ...message };
  const sensitivePatterns = {
    creditCard: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    password: /(?i)password[s]?\s*[:=]\s*[^\s,;]{3,}/g,
    token: /(?i)(bearer|jwt|api[_-]?key|auth)[_-]?token[s]?\s*[:=]\s*[^\s,;]{3,}/g,
    apiKey: /(?i)api[_-]?key[s]?\s*[:=]\s*[^\s,;]{3,}/g,
  };

  const mask = (str: string): string => {
    if (!str) return str;
    Object.entries(sensitivePatterns).forEach(([_, pattern]) => {
      str = str.replace(pattern, '***MASKED***');
    });
    return str;
  };

  Object.keys(maskedMessage).forEach((key) => {
    if (typeof maskedMessage[key] === 'object') {
      maskedMessage[key] = maskSensitiveData(maskedMessage[key]);
    } else if (typeof maskedMessage[key] === 'string') {
      maskedMessage[key] = mask(maskedMessage[key]);
    }
  });

  return maskedMessage;
}

/**
 * Creates and configures the Winston logger instance
 * @returns Configured Winston logger
 */
function createLogger(): Logger {
  const logDir = path.join(process.cwd(), logging.outputPath);
  
  // Configure console transport
  const consoleTransport = new transports.Console({
    level: logging.level,
    format: format.combine(
      format.timestamp(),
      format.errors({ stack: true }),
      env === 'development' ? format.prettyPrint() : format.json(),
    ),
  });

  // Configure file transport for production
  const fileTransport = new transports.File({
    filename: path.join(logDir, 'api-gateway-error.log'),
    level: 'error',
    format: format.combine(
      format.timestamp(),
      format.errors({ stack: true }),
      format.json(),
    ),
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    tailable: true,
    zippedArchive: true,
  });

  // Create logger instance with configured transports
  const logger = winston.createLogger({
    levels: LOG_LEVELS,
    format: format.combine(
      format.timestamp(),
      metadataFormat(),
      maskFormat(),
      format.errors({ stack: true }),
    ),
    transports: [
      consoleTransport,
      ...(env === 'production' ? [fileTransport] : []),
    ],
    exitOnError: false,
  });

  // Add batching for performance optimization in production
  if (env === 'production') {
    logger.configure({
      transports: logger.transports.map(transport => {
        if (transport instanceof transports.File) {
          return new winston.transports.File({
            ...transport.options,
            batch: true,
            batchCount: 100,
            batchInterval: 5000,
          });
        }
        return transport;
      }),
    });
  }

  return logger;
}

/**
 * Enhanced error logging with monitoring integration
 * @param error - Error object to log
 * @param correlationId - Request correlation ID
 * @param metadata - Additional context metadata
 */
export function logError(
  error: Error,
  correlationId?: string,
  metadata: Record<string, any> = {}
): void {
  const errorContext = {
    correlationId,
    stack: error.stack,
    ...metadata,
    timestamp: new Date().toISOString(),
  };

  // Log to Winston
  logger.error({
    message: error.message,
    ...errorContext,
  });

  // Report to Sentry if available
  if (Sentry.getCurrentHub().getClient()) {
    Sentry.withScope(scope => {
      scope.setExtra('correlationId', correlationId);
      Object.entries(metadata).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
      Sentry.captureException(error);
    });
  }
}

// Create and export logger instance
export const logger = createLogger();

// Export default logger methods for convenience
export default {
  error: logger.error.bind(logger),
  warn: logger.warn.bind(logger),
  info: logger.info.bind(logger),
  debug: logger.debug.bind(logger),
  logError,
};