import express, { Request, Response, NextFunction } from 'express'; // ^4.18.2
import Joi from 'joi'; // ^17.9.0
import { StatusCodes } from 'http-status-codes'; // ^2.3.0
import { authenticate, authorize } from '../auth/auth.middleware';
import { validateRequest } from '../middleware/request.validator';
import { grpcClientManager } from '../grpc/client';
import { rateLimiter } from '../middleware/rate.limiter';
import { ExportFormat } from '../types';
import logger from '../utils/logger';

const router = express.Router();

// Validation schemas for export requests
const exportRequestSchema = Joi.object({
  topicId: Joi.string().required().uuid(),
  format: Joi.string().required().valid(...Object.values(ExportFormat)),
  options: Joi.object({
    includeGraphs: Joi.boolean().default(true),
    includeReferences: Joi.boolean().default(true),
    customStyles: Joi.object().pattern(Joi.string(), Joi.string()),
    sectionsToInclude: Joi.array().items(Joi.string()),
    maxDepth: Joi.number().integer().min(1).max(10).default(3),
    templateId: Joi.string().uuid()
  }).default({})
});

const exportProgressSchema = Joi.object({
  exportId: Joi.string().required().uuid()
});

// Rate limit configuration for export endpoints
const exportRateLimit = rateLimiter.withOptions({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 exports per hour
  message: 'Export rate limit exceeded. Please try again later.'
});

/**
 * Initiates document export process
 * POST /api/v1/export
 */
router.post('/',
  authenticate,
  authorize(['user', 'admin']),
  exportRateLimit,
  validateRequest({ body: exportRequestSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const correlationId = req.headers['x-correlation-id'] as string;

    try {
      logger.info('Starting document export', {
        correlationId,
        userId: req.user?.userId,
        format: req.body.format,
        topicId: req.body.topicId
      });

      // Get output service client with circuit breaker
      const outputClient = await grpcClientManager.getClient('output');

      // Transform request to gRPC message format
      const exportRequest = {
        topicId: req.body.topicId,
        format: ExportFormat[req.body.format],
        includeGraphs: req.body.options?.includeGraphs ?? true,
        includeReferences: req.body.options?.includeReferences ?? true,
        customStyles: req.body.options?.customStyles || {},
        sectionsToInclude: req.body.options?.sectionsToInclude || [],
        maxDepth: req.body.options?.maxDepth || 3,
        templateId: req.body.options?.templateId
      };

      // Call ExportDocument RPC with timeout
      const response = await new Promise((resolve, reject) => {
        outputClient.ExportDocument(exportRequest, { deadline: Date.now() + 30000 }, (err, response) => {
          if (err) {
            reject(err);
          } else {
            resolve(response);
          }
        });
      });

      // Log successful export initiation
      logger.info('Export initiated successfully', {
        correlationId,
        exportId: response.exportId,
        duration: Date.now() - startTime
      });

      // Return success response with export details
      res.status(StatusCodes.ACCEPTED).json({
        success: true,
        data: {
          exportId: response.exportId,
          status: response.status,
          estimatedCompletionTime: response.metadata?.estimatedCompletionTime,
          format: req.body.format
        },
        metadata: {
          correlationId,
          requestDuration: Date.now() - startTime
        }
      });

    } catch (error) {
      logger.error('Export request failed', {
        correlationId,
        error: error.message,
        duration: Date.now() - startTime
      });
      next(error);
    }
  }
);

/**
 * Retrieves export progress status
 * GET /api/v1/export/:exportId/progress
 */
router.get('/:exportId/progress',
  authenticate,
  authorize(['user', 'admin']),
  validateRequest({ params: exportProgressSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const correlationId = req.headers['x-correlation-id'] as string;

    try {
      logger.debug('Checking export progress', {
        correlationId,
        exportId: req.params.exportId
      });

      // Get output service client
      const outputClient = await grpcClientManager.getClient('output');

      // Call GetExportProgress RPC with timeout
      const response = await new Promise((resolve, reject) => {
        outputClient.GetExportProgress(
          { 
            exportId: req.params.exportId,
            includeDetails: true,
            includeErrors: true
          },
          { deadline: Date.now() + 5000 },
          (err, response) => {
            if (err) {
              reject(err);
            } else {
              resolve(response);
            }
          }
        );
      });

      // Transform progress response
      const progressResponse = {
        status: response.status,
        progress: response.progressPercentage,
        message: response.message,
        completedSteps: response.completedSteps,
        pendingSteps: response.pendingSteps,
        errors: response.errors?.map(error => ({
          code: error.code,
          message: error.message,
          details: error.details
        }))
      };

      // Log progress check
      logger.debug('Export progress retrieved', {
        correlationId,
        exportId: req.params.exportId,
        status: response.status,
        duration: Date.now() - startTime
      });

      // Return progress response
      res.status(StatusCodes.OK).json({
        success: true,
        data: progressResponse,
        metadata: {
          correlationId,
          requestDuration: Date.now() - startTime
        }
      });

    } catch (error) {
      logger.error('Export progress check failed', {
        correlationId,
        exportId: req.params.exportId,
        error: error.message,
        duration: Date.now() - startTime
      });
      next(error);
    }
  }
);

export default router;