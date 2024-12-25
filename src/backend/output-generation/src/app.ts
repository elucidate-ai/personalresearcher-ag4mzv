/**
 * @fileoverview Main application entry point for the Output Generation service
 * Initializes Express server with enterprise-grade security, monitoring, and performance optimizations
 * @version 1.0.0
 */

import express from 'express'; // ^4.18.0
import cors from 'cors'; // ^2.8.5
import helmet from 'helmet'; // ^7.0.0
import compression from 'compression'; // ^1.7.4
import rateLimit from 'express-rate-limit'; // ^6.7.0
import { body, validationResult } from 'express-validator'; // ^7.0.0
import { v4 as uuid } from 'uuid'; // ^9.0.0
import { server as serverConfig, export as exportConfig } from './config/config';
import { logger } from './utils/logger';
import { ExportManager } from './core/export.manager';
import { ExportFormat } from './models/document.model';

// Initialize Express application
const app = express();

// Initialize Export Manager
const exportManager = new ExportManager();

/**
 * Configures Express middleware with enhanced security and monitoring
 */
function initializeMiddleware(app: express.Application): void {
    // Add request correlation ID
    app.use((req, res, next) => {
        req.id = uuid();
        res.setHeader('X-Request-ID', req.id);
        next();
    });

    // Security middleware
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'blob:'],
                connectSrc: ["'self'"]
            }
        },
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        }
    }));

    // CORS configuration
    app.use(cors({
        origin: serverConfig.corsOrigins,
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        exposedHeaders: ['X-Request-ID'],
        credentials: true,
        maxAge: 600 // 10 minutes
    }));

    // Response compression
    app.use(compression({
        threshold: 1024, // 1KB
        filter: (req, res) => {
            if (req.headers['x-no-compression']) {
                return false;
            }
            return compression.filter(req, res);
        }
    }));

    // Request parsing
    app.use(express.json({
        limit: exportConfig.maxFileSize,
        verify: (req, res, buf) => {
            req.rawBody = buf;
        }
    }));

    // Rate limiting
    const limiter = rateLimit({
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
        max: parseInt(process.env.REQUEST_LIMIT || '100', 10), // 100 requests per window
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            logger.warn('Rate limit exceeded', { 
                ip: req.ip, 
                id: req.id 
            });
            res.status(429).json({
                error: 'Too many requests',
                retryAfter: res.getHeader('Retry-After')
            });
        }
    });
    app.use('/api', limiter);

    // Trust proxy if configured
    if (serverConfig.trustProxy) {
        app.set('trust proxy', true);
    }
}

/**
 * Configures API routes with validation and error handling
 */
function setupRoutes(app: express.Application, exportManager: ExportManager): void {
    // Health check endpoint
    app.get('/health', (req, res) => {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version
        });
    });

    // Document export endpoint
    app.post('/api/export', [
        body('content').isObject().notEmpty(),
        body('format').isIn(exportConfig.supportedFormats),
        body('options').optional().isObject()
    ], async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { content, format, options } = req.body;
            const result = await exportManager.exportDocument(content, {
                format: format as ExportFormat,
                ...options
            });

            logger.info('Document exported successfully', {
                correlationId: result.correlationId,
                format,
                size: result.metadata.contentSize
            });

            res.json({
                correlationId: result.correlationId,
                status: 'completed',
                metadata: result.metadata
            });
        } catch (error) {
            next(error);
        }
    });

    // Export status endpoint
    app.get('/api/export/:correlationId/status', async (req, res, next) => {
        try {
            const { correlationId } = req.params;
            const status = exportManager.getExportStatus(correlationId);
            res.json(status);
        } catch (error) {
            next(error);
        }
    });

    // Error handling middleware
    app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
        logger.error('Request error', {
            error: err.message,
            stack: err.stack,
            correlationId: req.id
        });

        res.status(500).json({
            error: process.env.NODE_ENV === 'production' 
                ? 'Internal server error' 
                : err.message,
            correlationId: req.id
        });
    });
}

/**
 * Initializes and starts the Express server
 */
async function startServer(app: express.Application): Promise<void> {
    try {
        const port = serverConfig.port;
        const host = serverConfig.host;

        // Initialize middleware and routes
        initializeMiddleware(app);
        setupRoutes(app, exportManager);

        // Start server
        app.listen(port, host, () => {
            logger.info('Server started', {
                port,
                host,
                env: process.env.NODE_ENV,
                nodeVersion: process.version
            });
        });

        // Graceful shutdown handler
        process.on('SIGTERM', () => {
            logger.info('Received SIGTERM signal, initiating graceful shutdown');
            process.exit(0);
        });

    } catch (error) {
        logger.error('Server startup failed', { error });
        process.exit(1);
    }
}

// Start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
    startServer(app).catch(error => {
        logger.error('Failed to start server', { error });
        process.exit(1);
    });
}

// Export app for testing
export { app };