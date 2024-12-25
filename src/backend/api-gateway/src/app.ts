import express, { Application, Request, Response, NextFunction } from 'express'; // ^4.18.2
import cors from 'cors'; // ^2.8.5
import helmet from 'helmet'; // ^7.1.0
import compression from 'compression'; // ^1.7.4
import morgan from 'morgan'; // ^1.10.0
import { expressjwt } from 'express-jwt'; // ^8.4.1
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0

// Import configuration and middleware
import { config, port, cors as corsConfig, auth } from './config/config';
import { errorHandler } from './middleware/error.handler';
import { rateLimiter } from './middleware/rate.limiter';
import { authenticate } from './auth/auth.middleware';
import healthRouter from './routes/health.routes';
import { logger } from './utils/logger';

// Initialize express application
const app: Application = express();

/**
 * Configures all application middleware with enhanced security and monitoring
 * @param app Express application instance
 */
function setupMiddleware(app: Application): void {
  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "same-site" },
    dnsPrefetchControl: { allow: false },
    expectCt: { enforce: true, maxAge: 30 },
    frameguard: { action: "deny" },
    hidePoweredBy: true,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    ieNoOpen: true,
    noSniff: true,
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
    referrerPolicy: { policy: "same-origin" },
    xssFilter: true,
  }));

  // CORS configuration
  app.use(cors({
    origin: corsConfig.origin,
    methods: corsConfig.methods,
    credentials: corsConfig.credentials,
    maxAge: corsConfig.maxAge,
    allowedHeaders: corsConfig.allowedHeaders,
    exposedHeaders: corsConfig.exposedHeaders,
  }));

  // Request parsing and compression
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(compression());

  // Request logging with correlation IDs
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.correlationId = req.headers['x-correlation-id'] as string || uuidv4();
    next();
  });

  app.use(morgan(':method :url :status :response-time ms - :res[content-length]', {
    stream: {
      write: (message: string) => {
        logger.info(message.trim());
      },
    },
  }));

  // Rate limiting
  app.use(rateLimiter);

  // JWT authentication
  app.use(
    expressjwt({
      secret: auth.jwtSecret,
      algorithms: ['RS256'],
      credentialsRequired: false,
      requestProperty: 'auth',
    }).unless({ path: ['/health', '/metrics', '/api/v1/auth/login'] })
  );

  // Custom authentication middleware
  app.use('/api', authenticate);
}

/**
 * Configures all application routes with proper security and monitoring
 * @param app Express application instance
 */
function setupRoutes(app: Application): void {
  // Health check routes
  app.use('/health', healthRouter);

  // API routes with version prefix
  app.use('/api/v1', (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-API-Version', '1.0');
    next();
  });

  // Handle 404 errors
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'Resource not found',
    });
  });

  // Global error handler
  app.use(errorHandler);
}

// Initialize application
setupMiddleware(app);
setupRoutes(app);

// Start server with graceful shutdown
const server = app.listen(port, () => {
  logger.info(`API Gateway listening on port ${port}`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Starting graceful shutdown...');
  server.close(() => {
    logger.info('Server closed. Process terminating...');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
});

// Unhandled rejection handling
process.on('unhandledRejection', (reason: Error) => {
  logger.error('Unhandled Promise Rejection', {
    error: reason.message,
    stack: reason.stack,
  });
});

// Uncaught exception handling
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

export default app;