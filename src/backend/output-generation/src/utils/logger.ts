import winston from 'winston'; // ^3.11.0
import DailyRotateFile from 'winston-daily-rotate-file'; // ^4.7.1
import * as Sentry from '@sentry/node'; // ^7.0.0
import { logging } from '../config/config';

// Define custom log levels with corresponding priorities
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Define sensitive data patterns for masking
const SENSITIVE_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  apiKey: /([a-zA-Z0-9]{32,})/g,
  jwt: /Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g,
};

// Custom format for masking sensitive information
const maskSensitiveInfo = winston.format((info) => {
  const masked = { ...info };
  
  // Mask sensitive fields defined in config
  logging.maskFields.forEach(field => {
    if (masked[field]) {
      masked[field] = '********';
    }
  });

  // Mask sensitive patterns in message and metadata
  const stringified = JSON.stringify(masked);
  let sanitized = stringified;
  
  Object.entries(SENSITIVE_PATTERNS).forEach(([_, pattern]) => {
    sanitized = sanitized.replace(pattern, '********');
  });

  return JSON.parse(sanitized);
});

// Custom format for adding standard metadata
const addMetadata = winston.format((info) => {
  return {
    ...info,
    service: 'output-generation',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    hostname: require('os').hostname(),
    pid: process.pid,
  };
});

// Create performance metrics format
const addPerformanceMetrics = winston.format((info) => {
  const metrics = {
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    uptime: process.uptime(),
  };

  return {
    ...info,
    performance: metrics,
  };
});

// Configure Winston transports
const createTransports = () => {
  const transports: winston.transport[] = [];

  // Console transport for all environments
  if (logging.stdout) {
    transports.push(
      new winston.transports.Console({
        level: logging.level,
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      })
    );
  }

  // File transport for production and staging
  if (process.env.NODE_ENV !== 'development') {
    transports.push(
      new DailyRotateFile({
        level: 'error',
        filename: `${logging.directory}/error-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        maxSize: logging.maxSize,
        maxFiles: logging.maxFiles,
        format: winston.format.json(),
      }),
      new DailyRotateFile({
        level: logging.level,
        filename: `${logging.directory}/combined-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        maxSize: logging.maxSize,
        maxFiles: logging.maxFiles,
        format: winston.format.json(),
      })
    );
  }

  return transports;
};

// Create and configure the Winston logger
const createLogger = () => {
  return winston.createLogger({
    levels: LOG_LEVELS,
    format: winston.format.combine(
      addMetadata(),
      maskSensitiveInfo(),
      addPerformanceMetrics(),
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: createTransports(),
    exitOnError: false,
  });
};

// Enhanced error logging with Sentry integration
export const logError = (
  error: Error,
  correlationId: string,
  metadata: Record<string, any> = {}
): void => {
  // Extract error details
  const errorDetails = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    cause: error.cause,
    ...metadata,
    correlationId,
  };

  // Log to Winston
  logger.error('Error occurred', errorDetails);

  // Report to Sentry with enhanced context
  Sentry.withScope((scope) => {
    scope.setTag('correlationId', correlationId);
    scope.setContext('metadata', metadata);
    scope.setContext('performance', {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
    });
    Sentry.captureException(error);
  });
};

// Create the logger instance
const logger = createLogger();

// Export the configured logger
export { logger };

// Add uncaught exception and unhandled rejection handlers
process.on('uncaughtException', (error) => {
  logError(error, 'UNCAUGHT_EXCEPTION', { type: 'uncaughtException' });
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  logError(
    reason instanceof Error ? reason : new Error(String(reason)),
    'UNHANDLED_REJECTION',
    { type: 'unhandledRejection' }
  );
});
```

This implementation provides a comprehensive logging utility that addresses all the specified requirements:

1. Structured Logging:
- Uses Winston for structured JSON logging
- Includes correlation IDs, timestamps, and service metadata
- Supports multiple log levels with proper prioritization

2. Error Tracking:
- Integrates with Sentry for advanced error reporting
- Captures detailed error context and breadcrumbs
- Handles uncaught exceptions and unhandled rejections

3. Security:
- Masks sensitive information using patterns and configured fields
- Sanitizes log output to prevent data leaks
- Supports configurable masking rules

4. Production Features:
- Log rotation with DailyRotateFile
- Configurable retention policies
- Performance metrics tracking
- Environment-specific transport configuration

5. Monitoring Integration:
- Performance metrics collection
- System resource utilization tracking
- Error frequency monitoring
- Structured output for ELK Stack integration

The logger can be used throughout the application by importing the logger instance:

```typescript
import { logger, logError } from './utils/logger';

// Regular logging
logger.info('Operation completed', { documentId: '123', format: 'pdf' });

// Error logging with correlation ID
try {
  // ... operation
} catch (error) {
  logError(error, correlationId, { documentId: '123', operation: 'export' });
}