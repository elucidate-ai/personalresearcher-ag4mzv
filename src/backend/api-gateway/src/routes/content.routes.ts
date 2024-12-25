import express, { Request, Response, NextFunction } from 'express'; // ^4.18.2
import { StatusCodes } from 'http-status-codes'; // ^2.3.0
import Joi from 'joi'; // ^17.9.0
import { authenticate, authorize } from '../auth/auth.middleware';
import { validateRequest } from '../middleware/request.validator';
import { rateLimiter } from '../middleware/rate.limiter';
import { grpcClientManager } from '../grpc/client';
import { ContentType } from '../types';
import logger from '../utils/logger';

// Initialize router
const contentRouter = express.Router();

// Validation schemas
const discoverContentSchema = {
  body: Joi.object({
    topicId: Joi.string().required(),
    contentTypes: Joi.array().items(
      Joi.string().valid(...Object.values(ContentType))
    ),
    minQualityScore: Joi.number().min(0).max(1),
    maxResults: Joi.number().integer().min(1).max(100),
    filters: Joi.object({
      language: Joi.string(),
      publishedAfter: Joi.date().iso(),
      publishedBefore: Joi.date().iso(),
      excludedSources: Joi.array().items(Joi.string())
    })
  })
};

const assessQualitySchema = {
  body: Joi.object({
    contentId: Joi.string().required(),
    type: Joi.string().valid(...Object.values(ContentType)).required(),
    contentData: Joi.string().required(),
    evaluationAspects: Joi.array().items(Joi.string()),
    deepAnalysis: Joi.boolean()
  })
};

const aggregateSourcesSchema = {
  body: Joi.object({
    topicId: Joi.string().required(),
    sourceIds: Joi.array().items(Joi.string()),
    maxItemsPerSource: Joi.number().integer().min(1).max(50),
    deduplicate: Joi.boolean(),
    sourceFilters: Joi.object()
  })
};

/**
 * Discovers content based on topic and filters
 * Rate limit: 100 requests/minute
 */
contentRouter.post('/discover',
  authenticate,
  authorize(['user', 'admin']),
  rateLimiter,
  validateRequest(discoverContentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const correlationId = req.headers['x-correlation-id'] as string;
    const startTime = Date.now();

    try {
      logger.info({
        message: 'Content discovery request received',
        correlationId,
        topicId: req.body.topicId,
        contentTypes: req.body.contentTypes
      });

      const contentClient = await grpcClientManager.getClient('content');
      
      const response = await new Promise((resolve, reject) => {
        contentClient.DiscoverContent(req.body, {
          deadline: Date.now() + 30000, // 30 second timeout
          metadata: { correlationId }
        }, (error, response) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        });
      });

      logger.info({
        message: 'Content discovery completed',
        correlationId,
        duration: Date.now() - startTime,
        itemsFound: response.totalFound
      });

      res.status(StatusCodes.OK).json({
        success: true,
        data: response,
        metadata: {
          correlationId,
          processingTime: Date.now() - startTime
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Assesses content quality using ML-based scoring
 * Rate limit: 100 requests/minute
 */
contentRouter.post('/assess-quality',
  authenticate,
  authorize(['content-manager', 'admin']),
  rateLimiter,
  validateRequest(assessQualitySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const correlationId = req.headers['x-correlation-id'] as string;
    const startTime = Date.now();

    try {
      logger.info({
        message: 'Quality assessment request received',
        correlationId,
        contentId: req.body.contentId,
        contentType: req.body.type
      });

      const contentClient = await grpcClientManager.getClient('content');
      
      const response = await new Promise((resolve, reject) => {
        contentClient.AssessQuality(req.body, {
          deadline: Date.now() + 45000, // 45 second timeout
          metadata: { correlationId }
        }, (error, response) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        });
      });

      logger.info({
        message: 'Quality assessment completed',
        correlationId,
        duration: Date.now() - startTime,
        qualityScore: response.qualityScore
      });

      res.status(StatusCodes.OK).json({
        success: true,
        data: response,
        metadata: {
          correlationId,
          processingTime: Date.now() - startTime
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Aggregates content from multiple sources with deduplication
 * Rate limit: 100 requests/minute
 */
contentRouter.post('/aggregate-sources',
  authenticate,
  authorize(['content-manager', 'admin']),
  rateLimiter,
  validateRequest(aggregateSourcesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const correlationId = req.headers['x-correlation-id'] as string;
    const startTime = Date.now();

    try {
      logger.info({
        message: 'Source aggregation request received',
        correlationId,
        topicId: req.body.topicId,
        sourceCount: req.body.sourceIds?.length
      });

      const contentClient = await grpcClientManager.getClient('content');
      
      const response = await new Promise((resolve, reject) => {
        contentClient.AggregateSources(req.body, {
          deadline: Date.now() + 60000, // 60 second timeout
          metadata: { correlationId }
        }, (error, response) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        });
      });

      logger.info({
        message: 'Source aggregation completed',
        correlationId,
        duration: Date.now() - startTime,
        aggregatedCount: response.aggregatedContent?.length,
        duplicatesFound: response.duplicateCount
      });

      res.status(StatusCodes.OK).json({
        success: true,
        data: response,
        metadata: {
          correlationId,
          processingTime: Date.now() - startTime
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

export { contentRouter };