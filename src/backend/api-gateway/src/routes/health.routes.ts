import express, { Request, Response, Router } from 'express'; // ^4.18.2
import { register, Gauge, Counter } from 'prom-client'; // ^14.0.0
import { logger } from '../utils/logger';
import { grpcClientManager } from '../grpc/client';
import { services } from '../config/config';

// Initialize Prometheus metrics
const upGauge = new Gauge({
  name: 'api_gateway_up',
  help: 'API Gateway uptime status (1 = up, 0 = down)',
});

const healthCheckDuration = new Gauge({
  name: 'api_gateway_health_check_duration_seconds',
  help: 'Duration of health check execution',
  labelNames: ['check_type'],
});

const dependencyHealth = new Gauge({
  name: 'api_gateway_dependency_health',
  help: 'Health status of dependencies (1 = healthy, 0 = unhealthy)',
  labelNames: ['service'],
});

const healthCheckTotal = new Counter({
  name: 'api_gateway_health_checks_total',
  help: 'Total number of health checks performed',
  labelNames: ['type', 'status'],
});

interface ServiceHealthStatus {
  service: string;
  status: 'healthy' | 'unhealthy';
  responseTime: number;
  lastCheck: Date;
  error?: string;
}

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  dependencies: ServiceHealthStatus[];
  details: {
    uptime: number;
    memory: {
      used: number;
      total: number;
      percentUsed: number;
    };
    cpu: {
      load: number;
      cores: number;
    };
  };
}

/**
 * Performs comprehensive health checks on all service dependencies
 */
async function checkDependenciesHealth(correlationId: string): Promise<ServiceHealthStatus[]> {
  const startTime = Date.now();
  logger.info('Starting dependency health checks', { correlationId });

  const healthChecks = Object.keys(services).map(async (serviceName) => {
    const checkStartTime = Date.now();
    try {
      const status = await grpcClientManager.getHealthStatus(serviceName);
      const metrics = grpcClientManager.getMetrics(serviceName);
      
      const healthStatus: ServiceHealthStatus = {
        service: serviceName,
        status: status?.status === 'SERVING' ? 'healthy' : 'unhealthy',
        responseTime: status?.responseTime || 0,
        lastCheck: status?.lastCheck || new Date(),
        error: metrics?.lastError?.message
      };

      // Update Prometheus metrics
      dependencyHealth.set(
        { service: serviceName },
        healthStatus.status === 'healthy' ? 1 : 0
      );

      return healthStatus;
    } catch (error) {
      logger.error('Dependency health check failed', {
        correlationId,
        service: serviceName,
        error
      });

      dependencyHealth.set({ service: serviceName }, 0);
      
      return {
        service: serviceName,
        status: 'unhealthy',
        responseTime: Date.now() - checkStartTime,
        lastCheck: new Date(),
        error: error.message
      };
    }
  });

  const results = await Promise.all(healthChecks);
  healthCheckDuration.set({ check_type: 'dependencies' }, (Date.now() - startTime) / 1000);
  
  return results;
}

/**
 * Handler for liveness probe endpoint
 */
async function getLivenessHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.headers['x-correlation-id'] as string;
  const startTime = Date.now();

  try {
    logger.info('Liveness check initiated', { correlationId });
    
    // Basic service health check
    upGauge.set(1);
    healthCheckTotal.inc({ type: 'liveness', status: 'success' });

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    logger.error('Liveness check failed', { correlationId, error });
    upGauge.set(0);
    healthCheckTotal.inc({ type: 'liveness', status: 'failure' });
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  } finally {
    healthCheckDuration.set(
      { check_type: 'liveness' },
      (Date.now() - startTime) / 1000
    );
  }
}

/**
 * Handler for readiness probe endpoint with comprehensive health checks
 */
async function getReadinessHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.headers['x-correlation-id'] as string;
  const startTime = Date.now();

  try {
    logger.info('Readiness check initiated', { correlationId });

    // Check all dependencies
    const dependencies = await checkDependenciesHealth(correlationId);
    
    // Get system metrics
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const response: HealthCheckResponse = {
      status: dependencies.every(d => d.status === 'healthy') ? 'healthy' : 
             dependencies.some(d => d.status === 'healthy') ? 'degraded' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || 'unknown',
      dependencies,
      details: {
        uptime: process.uptime(),
        memory: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          percentUsed: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
        },
        cpu: {
          load: cpuUsage.user / 1000000, // Convert to seconds
          cores: require('os').cpus().length
        }
      }
    };

    healthCheckTotal.inc({
      type: 'readiness',
      status: response.status
    });

    const statusCode = response.status === 'healthy' ? 200 :
                      response.status === 'degraded' ? 207 : 503;

    res.status(statusCode).json(response);
  } catch (error) {
    logger.error('Readiness check failed', { correlationId, error });
    healthCheckTotal.inc({ type: 'readiness', status: 'failure' });
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  } finally {
    healthCheckDuration.set(
      { check_type: 'readiness' },
      (Date.now() - startTime) / 1000
    );
  }
}

/**
 * Handler for Prometheus metrics endpoint
 */
async function getMetricsHandler(_req: Request, res: Response): Promise<void> {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate metrics' });
  }
}

// Create and configure router
const healthRouter: Router = express.Router();

healthRouter.get('/live', getLivenessHandler);
healthRouter.get('/ready', getReadinessHandler);
healthRouter.get('/metrics', getMetricsHandler);

export default healthRouter;