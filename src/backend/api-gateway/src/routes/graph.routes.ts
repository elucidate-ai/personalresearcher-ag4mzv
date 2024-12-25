import { Router, Request, Response, NextFunction } from 'express'; // ^4.18.2
import { StatusCodes } from 'http-status-codes'; // ^2.3.0
import rateLimit from 'express-rate-limit'; // ^7.1.0
import cache from 'express-cache-middleware'; // ^2.0.0
import { authenticate, authorize } from '../auth/auth.middleware';
import { grpcClientManager } from '../grpc/client';
import { ApiError } from '../middleware/error.handler';
import { ErrorType, GraphRequest, ApiResponse } from '../types';
import logger from '../utils/logger';

// Initialize router
const router = Router();

// Configure rate limiting for graph operations
const graphRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many graph operations from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Configure caching for appropriate endpoints
const cacheConfig = {
  ttl: 300, // 5 minutes cache
  prefix: 'graph-cache:',
};
cache.attach(router, cacheConfig);

/**
 * Creates a new knowledge graph for a topic
 * @route POST /graphs
 * @security JWT
 */
router.post(
  '/',
  authenticate,
  authorize(['basic_user', 'premium_user', 'admin']),
  graphRateLimit,
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    try {
      const { topicId, options } = req.body as GraphRequest;

      // Input validation
      if (!topicId) {
        throw new ApiError(
          'Topic ID is required',
          StatusCodes.BAD_REQUEST,
          ErrorType.VALIDATION_ERROR,
          { correlationId: req.correlationId }
        );
      }

      // Get knowledge service client with circuit breaker
      const knowledgeClient = await grpcClientManager.getClient('knowledgeService');

      // Log operation start
      logger.info({
        message: 'Creating knowledge graph',
        correlationId: req.correlationId,
        topicId,
        userId: req.user?.userId,
      });

      // Create graph with timeout and metadata
      const response = await new Promise((resolve, reject) => {
        knowledgeClient.CreateGraph(
          {
            topic_id: topicId,
            metadata: {
              userId: req.user?.userId,
              correlationId: req.correlationId,
              ...options?.metadata,
            },
          },
          { deadline: Date.now() + 30000 }, // 30 second timeout
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
      });

      // Log successful operation
      logger.info({
        message: 'Knowledge graph created successfully',
        correlationId: req.correlationId,
        topicId,
        graphId: response.id,
        duration: Date.now() - startTime,
      });

      // Return success response
      const apiResponse: ApiResponse = {
        success: true,
        data: response,
        metadata: {
          correlationId: req.correlationId,
          processingTime: Date.now() - startTime,
        },
      };

      res.status(StatusCodes.CREATED).json(apiResponse);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Retrieves a knowledge graph by ID
 * @route GET /graphs/:id
 * @security JWT
 */
router.get(
  '/:id',
  authenticate,
  authorize(['basic_user', 'premium_user', 'admin']),
  cache.middleware(),
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    try {
      const { id } = req.params;

      const knowledgeClient = await grpcClientManager.getClient('knowledgeService');

      logger.info({
        message: 'Retrieving knowledge graph',
        correlationId: req.correlationId,
        graphId: id,
        userId: req.user?.userId,
      });

      const response = await new Promise((resolve, reject) => {
        knowledgeClient.GetGraph(
          { graph_id: id },
          { deadline: Date.now() + 10000 },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
      });

      logger.info({
        message: 'Knowledge graph retrieved successfully',
        correlationId: req.correlationId,
        graphId: id,
        duration: Date.now() - startTime,
      });

      const apiResponse: ApiResponse = {
        success: true,
        data: response,
        metadata: {
          correlationId: req.correlationId,
          processingTime: Date.now() - startTime,
        },
      };

      res.status(StatusCodes.OK).json(apiResponse);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Analyzes a knowledge graph
 * @route POST /graphs/:id/analyze
 * @security JWT
 */
router.post(
  '/:id/analyze',
  authenticate,
  authorize(['premium_user', 'admin']),
  graphRateLimit,
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    try {
      const { id } = req.params;
      const { metrics = [] } = req.body;

      const knowledgeClient = await grpcClientManager.getClient('knowledgeService');

      logger.info({
        message: 'Analyzing knowledge graph',
        correlationId: req.correlationId,
        graphId: id,
        metrics,
        userId: req.user?.userId,
      });

      const response = await new Promise((resolve, reject) => {
        knowledgeClient.AnalyzeGraph(
          {
            graph_id: id,
            metrics,
          },
          { deadline: Date.now() + 60000 },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
      });

      logger.info({
        message: 'Knowledge graph analysis completed',
        correlationId: req.correlationId,
        graphId: id,
        duration: Date.now() - startTime,
      });

      const apiResponse: ApiResponse = {
        success: true,
        data: response,
        metadata: {
          correlationId: req.correlationId,
          processingTime: Date.now() - startTime,
        },
      };

      res.status(StatusCodes.OK).json(apiResponse);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Health check endpoint for graph service
 * @route GET /graphs/health
 */
router.get('/health', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const status = grpcClientManager.getHealthStatus('knowledgeService');
    const metrics = grpcClientManager.getMetrics('knowledgeService');

    const healthResponse = {
      status: status?.status || 'UNKNOWN',
      lastCheck: status?.lastCheck,
      metrics: {
        requestCount: metrics?.requestCount || 0,
        errorRate: metrics ? (metrics.errorCount / metrics.requestCount) * 100 : 0,
        avgResponseTime: metrics?.avgResponseTime || 0,
      },
    };

    res.status(StatusCodes.OK).json(healthResponse);
  } catch (error) {
    next(error);
  }
});

export default router;