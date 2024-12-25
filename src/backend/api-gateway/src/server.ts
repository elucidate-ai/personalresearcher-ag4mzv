import http from 'http'; // built-in
import app from './app';
import { config } from './config/config';
import { logger } from './utils/logger';

/**
 * Decorator for monitoring server functions
 */
function monitoredFunction(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = async function(...args: any[]) {
    const startTime = Date.now();
    const correlationId = `srv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info({
        message: `Starting ${propertyKey}`,
        correlationId,
        function: propertyKey
      });
      
      const result = await originalMethod.apply(this, args);
      
      logger.info({
        message: `Completed ${propertyKey}`,
        correlationId,
        duration: Date.now() - startTime,
        function: propertyKey
      });
      
      return result;
    } catch (error) {
      logger.error({
        message: `Error in ${propertyKey}`,
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        function: propertyKey
      });
      throw error;
    }
  };
  return descriptor;
}

class APIGatewayServer {
  private server: http.Server;
  private isShuttingDown: boolean = false;
  private connections: Set<any> = new Set();

  constructor() {
    this.server = http.createServer(app);
    this.setupServerEvents();
    this.setupProcessEvents();
  }

  /**
   * Initializes and starts the HTTP server with comprehensive monitoring
   */
  @monitoredFunction
  public async startServer(): Promise<void> {
    try {
      // Configure server timeouts
      this.server.keepAliveTimeout = config.serverConfig.keepAliveTimeout || 65000;
      this.server.headersTimeout = config.serverConfig.headersTimeout || 66000;
      this.server.maxHeaderSize = config.serverConfig.maxHeaderSize || 32768;
      
      // Track connections for graceful shutdown
      this.server.on('connection', (connection) => {
        this.connections.add(connection);
        connection.on('close', () => {
          this.connections.delete(connection);
        });
      });

      // Start listening
      await new Promise<void>((resolve) => {
        this.server.listen(config.port, () => {
          logger.info({
            message: `API Gateway server started`,
            port: config.port,
            environment: config.env,
            nodeVersion: process.version,
            pid: process.pid
          });
          resolve();
        });
      });
    } catch (error) {
      await this.handleServerError(error);
      process.exit(1);
    }
  }

  /**
   * Comprehensive error handler for server-level errors
   */
  @monitoredFunction
  private async handleServerError(error: Error): Promise<void> {
    const correlationId = `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    logger.error({
      message: 'Server error occurred',
      correlationId,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    if (!this.isShuttingDown) {
      await this.gracefulShutdown('error');
    }
  }

  /**
   * Performs graceful shutdown with comprehensive cleanup
   */
  @monitoredFunction
  private async gracefulShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.info('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    logger.info({
      message: 'Starting graceful shutdown',
      signal,
      activeConnections: this.connections.size
    });

    try {
      // Stop accepting new connections
      this.server.close();

      // Set shutdown timeout
      const shutdownTimeout = setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 30000);

      // Close existing connections
      for (const connection of this.connections) {
        connection.end();
      }

      // Wait for server to close
      await new Promise<void>((resolve) => {
        this.server.close(() => resolve());
      });

      clearTimeout(shutdownTimeout);
      
      logger.info({
        message: 'Graceful shutdown completed',
        signal,
        duration: 'Server shutdown completed successfully'
      });

      process.exit(0);
    } catch (error) {
      logger.error({
        message: 'Error during shutdown',
        error: error instanceof Error ? error.message : 'Unknown error',
        signal
      });
      process.exit(1);
    }
  }

  private setupServerEvents(): void {
    this.server.on('error', this.handleServerError.bind(this));
    
    this.server.on('clientError', (err, socket) => {
      logger.error({
        message: 'Client connection error',
        error: err.message,
        remoteAddress: socket.remoteAddress
      });
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    });
  }

  private setupProcessEvents(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      await this.handleServerError(error);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason) => {
      await this.handleServerError(reason as Error);
    });

    // Handle termination signals
    process.on('SIGTERM', async () => {
      await this.gracefulShutdown('SIGTERM');
    });

    process.on('SIGINT', async () => {
      await this.gracefulShutdown('SIGINT');
    });
  }
}

// Initialize and start server
const server = new APIGatewayServer();
server.startServer().catch((error) => {
  logger.error({
    message: 'Failed to start server',
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined
  });
  process.exit(1);
});