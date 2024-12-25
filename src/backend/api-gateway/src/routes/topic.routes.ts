import express, { Request, Response, NextFunction } from 'express'; // ^4.18.2
import Joi from 'joi'; // ^17.9.0
import { StatusCodes } from 'http-status-codes'; // ^2.3.0
import compression from 'compression'; // ^1.7.4
import CircuitBreaker from 'circuit-breaker-js'; // ^0.0.1
import { RateLimiterMemory } from 'rate-limiter-flexible'; // ^2.4.1

import { authenticate, authorize } from '../auth/auth.middleware';
import { validateRequest } from '../middleware/request.validator';
import { grpcClientManager } from '../grpc/client';
import { ApiError } from '../middleware/error.handler';
import logger from '../utils/logger';
import { ErrorType, Topic, ContentType } from '../types';

// Initialize router with compression
const router = express.Router();
router.use(compression());

// Initialize rate limiter (1000 requests per hour per user)
const rateLimiter = new RateLimiterMemory({
  points: 1000,
  duration: 3600,
  blockDuration: 300, // 5 minutes block duration
});

// Validation schemas
const topicSchema = {
  body: Joi.object({
    name: Joi.string().required().min(3).max(100).trim(),
    contentTypes: Joi.array()
      .items(Joi.string().valid(...Object.values(ContentType)))
      .min(1)
      .required(),
    filters: Joi.object({
      minQualityScore: Joi.number().min(0).max(1),
      maxResults: Joi.number().integer().min(1).max(100),
      language: Joi.string().min(2).max(10),
      publishedAfter: Joi.date().iso(),
      publishedBefore: Joi.date().iso(),
      excludedSources: Joi.array().items(Joi.string())
    }).optional(),
    metadata: Joi.object().optional()
  })
};

const getTopicSchema = {
  params: Joi.object({
    topicId: Joi.string().required().uuid()
  }),
  query: Joi.object({
    includeContent: Joi.boolean().default(false),
    includeGraph: Joi.boolean().default(false)
  })
};

/**
 * Creates a new topic and initiates content discovery
 * POST /api/v1/topics
 */
router.post('/topics', 
  authenticate,
  authorize(['user', 'admin']),
  validateRequest(topicSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const correlationId = req.correlationId;
    const startTime = Date.now();

    try {
      // Rate limit check
      await rateLimiter.consume(req.user!.userId);

      // Get service clients with circuit breaker protection
      const contentClient = await grpcClientManager.getClient('content');
      const knowledgeClient = await grpcClientManager.getClient('knowledge');

      // Log request
      logger.info({
        message: 'Creating new topic',
        correlationId,
        userId: req.user!.userId,
        topicData: req.body
      });

      // Initiate content discovery
      const contentResponse = await new Promise((resolve, reject) => {
        contentClient.DiscoverContent({
          topic_id: undefined, // Will be generated
          content_types: req.body.contentTypes,
          min_quality_score: req.body.filters?.minQualityScore || 0.7,
          max_results: req.body.filters?.maxResults || 50,
          filters: req.body.filters,
          language_preference: req.body.filters?.language,
          published_after: req.body.filters?.publishedAfter,
          published_before: req.body.filters?.publishedBefore,
          excluded_sources: req.body.filters?.excludedSources
        }, (error, response) => {
          if (error) reject(error);
          else resolve(response);
        });
      });

      // Create knowledge graph
      const graphResponse = await new Promise((resolve, reject) => {
        knowledgeClient.CreateGraph({
          topic_id: (contentResponse as any).topic_id,
          metadata: req.body.metadata
        }, (error, response) => {
          if (error) reject(error);
          else resolve(response);
        });
      });

      // Prepare response
      const topic: Topic = {
        id: (contentResponse as any).topic_id,
        name: req.body.name,
        metadata: {
          ...req.body.metadata,
          contentCount: (contentResponse as any).total_found,
          averageQualityScore: (contentResponse as any).average_quality_score,
          graphDensity: (graphResponse as any).graph_density
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Set response headers
      res.setHeader('X-Response-Time', `${Date.now() - startTime}ms`);
      res.setHeader('X-Rate-Limit-Remaining', await rateLimiter.get(req.user!.userId));
      res.setHeader('Cache-Control', 'no-cache');

      // Send success response
      res.status(StatusCodes.CREATED).json({
        success: true,
        data: topic,
        metadata: {
          correlationId,
          processingTime: Date.now() - startTime
        }
      });

    } catch (error) {
      // Handle rate limit errors
      if (error.name === 'RateLimiterError') {
        return next(new ApiError(
          'Rate limit exceeded',
          StatusCodes.TOO_MANY_REQUESTS,
          ErrorType.SERVICE_ERROR,
          { correlationId }
        ));
      }

      // Log error and forward to error handler
      logger.error({
        message: 'Error creating topic',
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      next(error);
    }
  }
);

/**
 * Retrieves topic details with optional content and graph data
 * GET /api/v1/topics/:topicId
 */
router.get('/topics/:topicId',
  authenticate,
  validateRequest(getTopicSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const correlationId = req.correlationId;
    const startTime = Date.now();

    try {
      const { topicId } = req.params;
      const { includeContent, includeGraph } = req.query;

      // Get content client with circuit breaker
      const contentClient = await grpcClientManager.getClient('content');
      const knowledgeClient = await grpcClientManager.getClient('knowledge');

      // Fetch topic content
      const contentPromise = includeContent ? new Promise((resolve, reject) => {
        contentClient.DiscoverContent({
          topic_id: topicId
        }, (error, response) => {
          if (error) reject(error);
          else resolve(response);
        });
      }) : Promise.resolve(null);

      // Fetch knowledge graph
      const graphPromise = includeGraph ? new Promise((resolve, reject) => {
        knowledgeClient.GetGraph({
          graph_id: topicId
        }, (error, response) => {
          if (error) reject(error);
          else resolve(response);
        });
      }) : Promise.resolve(null);

      // Wait for all data
      const [content, graph] = await Promise.all([contentPromise, graphPromise]);

      // Set cache headers
      const maxAge = 300; // 5 minutes
      res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
      res.setHeader('ETag', `"topic-${topicId}-${Date.now()}"`);

      // Send response
      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          id: topicId,
          content: content?.items || [],
          graph: graph || null,
          metadata: {
            contentCount: content?.total_found || 0,
            graphDensity: graph?.graph_density || 0
          }
        },
        metadata: {
          correlationId,
          processingTime: Date.now() - startTime,
          cached: false
        }
      });

    } catch (error) {
      logger.error({
        message: 'Error retrieving topic',
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      next(error);
    }
  }
);

export default router;