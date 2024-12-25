// External dependencies
import winston, { Logger, format } from 'winston';  // winston@3.x
import { jest } from '@jest/globals';  // @jest/globals@29.x
import { v4 as uuidv4 } from 'uuid';  // uuid@9.x

// Global configuration with environment variable fallbacks
const TEST_LOG_LEVEL = process.env.TEST_LOG_LEVEL || 'info';
const TEST_LOG_SILENT = process.env.TEST_LOG_SILENT === 'true';
const TEST_LOG_MAX_CAPTURE = parseInt(process.env.TEST_LOG_MAX_CAPTURE || '1000');

// Types for log entries and options
interface LogEntry {
  level: string;
  message: string;
  correlationId: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface TestLoggerOptions {
  level?: string;
  silent?: boolean;
  correlationId?: string;
  maxCapture?: number;
}

/**
 * Enhanced test logger class with ELK Stack integration and advanced capture capabilities
 */
export class TestLogger {
  private logger: Logger;
  private capturedLogs: LogEntry[] = [];
  private isSilent: boolean;
  private correlationId: string;
  private maxCapture: number;

  constructor(options: TestLoggerOptions = {}) {
    this.correlationId = options.correlationId || uuidv4();
    this.isSilent = options.silent ?? TEST_LOG_SILENT;
    this.maxCapture = options.maxCapture ?? TEST_LOG_MAX_CAPTURE;

    // Configure Winston logger with ELK-compatible format
    this.logger = winston.createLogger({
      level: options.level || TEST_LOG_LEVEL,
      format: format.combine(
        format.timestamp(),
        format.json(),
        format.metadata(),
        format.errors({ stack: true })
      ),
      transports: [
        new winston.transports.Console({
          silent: this.isSilent,
          format: format.combine(
            format.colorize(),
            format.printf(({ timestamp, level, message, correlationId, metadata }) => {
              return `[${timestamp}] [${level}] [${correlationId}] ${message} ${
                metadata ? JSON.stringify(metadata) : ''
              }`;
            })
          )
        })
      ]
    });
  }

  /**
   * Logs a message with correlation ID and specified level
   */
  public log(level: string, message: string, metadata: Record<string, unknown> = {}): void {
    if (this.isSilent) return;

    const enhancedMetadata = {
      ...metadata,
      correlationId: this.correlationId,
      testContext: {
        testName: expect.getState().currentTestName,
        testFile: expect.getState().testPath
      }
    };

    const logEntry: LogEntry = {
      level,
      message,
      correlationId: this.correlationId,
      timestamp: new Date().toISOString(),
      metadata: enhancedMetadata
    };

    this.logger.log(level, message, enhancedMetadata);
    
    // Manage capture rotation
    if (this.capturedLogs.length >= this.maxCapture) {
      this.capturedLogs.shift();
    }
    this.capturedLogs.push(logEntry);
  }

  /**
   * Retrieves captured log entries with optional correlation ID filter
   */
  public getCapturedLogs(correlationId?: string): LogEntry[] {
    if (correlationId) {
      return this.capturedLogs.filter(log => log.correlationId === correlationId);
    }
    return [...this.capturedLogs];
  }

  /**
   * Clears all captured log entries and resets state
   */
  public clearCapturedLogs(): void {
    this.capturedLogs = [];
    this.logger.clear();
  }
}

/**
 * Creates a test-specific logger instance with configurable options and ELK Stack compatibility
 */
export function createTestLogger(options: TestLoggerOptions = {}): TestLogger {
  return new TestLogger(options);
}

/**
 * Captures logs during test execution for verification with correlation ID tracking
 */
export function captureTestLogs(logger: TestLogger): {
  logs: LogEntry[];
  clear: () => void;
  getByCorrelationId: (id: string) => LogEntry[];
} {
  return {
    logs: logger.getCapturedLogs(),
    clear: () => logger.clearCapturedLogs(),
    getByCorrelationId: (id: string) => logger.getCapturedLogs(id)
  };
}

/**
 * Clears captured logs from test logger and resets state
 */
export function clearTestLogs(logger: TestLogger): void {
  logger.clearCapturedLogs();
}

// Convenience methods for common log levels
export const testLogger = createTestLogger();