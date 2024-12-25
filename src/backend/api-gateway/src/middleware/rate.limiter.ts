import rateLimit from 'express-rate-limit'; // ^7.1.0
import RedisStore from 'rate-limit-redis'; // ^4.0.0
import Redis from 'ioredis'; // ^5.0.0
import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import { rateLimiting as rateLimitConfig, redis as redisConfig } from '../config/config';
import logger from '../utils/logger';
import { networkInterfaces } from 'os';
import { promisify } from 'util';

// Custom error class for rate limiting failures
export class RateLimiterError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'RateLimiterError';
  }
}

// Redis client interface for type safety
interface RedisClient extends Redis {
  status: string;
}

// Rate limiter options interface
interface RateLimiterOptions {
  windowMs: number;
  max: number;
  standardHeaders: boolean;
  legacyHeaders: boolean;
  skipFailedRequests: boolean;
  skipSuccessfulRequests: boolean;
  keyGenerator: (req: Request) => string;
  handler: (req: Request, res: Response, next: NextFunction) => void;
  skip: (req: Request) => boolean;
}

let redisClient: RedisClient;

/**
 * Creates and configures the distributed rate limiting middleware
 * @throws {RateLimiterError} When Redis connection fails
 * @returns Configured Express rate limiting middleware
 */
export function createRateLimiter() {
  try {
    // Initialize Redis client with cluster configuration
    redisClient = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      enableOfflineQueue: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError: (err: Error) => {
        logger.error('Redis reconnection error', { error: err.message });
        return true;
      }
    }) as RedisClient;

    // Handle Redis connection events
    redisClient.on('error', (err: Error) => {
      handleRateLimitError(new RateLimiterError('REDIS_ERROR', `Redis client error: ${err.message}`));
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected successfully');
    });

    // Configure rate limiter options
    const limiterOptions: RateLimiterOptions = {
      windowMs: rateLimitConfig.windowMs,
      max: rateLimitConfig.maxRequests,
      standardHeaders: true,
      legacyHeaders: false,
      skipFailedRequests: rateLimitConfig.skipFailedRequests,
      skipSuccessfulRequests: false,
      keyGenerator: (req: Request): string => {
        // Use user ID if authenticated, otherwise use IP
        const userId = (req as any).user?.id;
        const clientIp = getClientIp(req);
        return `${userId || clientIp}:${req.path}`;
      },
      handler: (req: Request, res: Response): void => {
        const retryAfter = Math.ceil(rateLimitConfig.windowMs / 1000);
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter
        });
      },
      skip: (req: Request): boolean => shouldSkipRateLimit(req)
    };

    // Create Redis store with appropriate TTL
    const store = new RedisStore({
      // @ts-ignore - Type mismatch in library definition
      client: redisClient,
      prefix: 'rl:',
      resetExpiryOnChange: true,
      sendCommand: (...args: string[]) => promisify(redisClient.send_command).bind(redisClient)(...args)
    });

    // Return configured middleware
    return rateLimit({
      ...limiterOptions,
      store
    });

  } catch (error) {
    handleRateLimitError(new RateLimiterError('INIT_ERROR', 'Failed to initialize rate limiter'));
    // Fallback to memory-based rate limiting
    return rateLimit({
      windowMs: rateLimitConfig.windowMs,
      max: rateLimitConfig.maxRequests
    });
  }
}

/**
 * Determines if rate limiting should be skipped for the request
 * @param req Express request object
 * @returns boolean indicating if rate limiting should be skipped
 */
function shouldSkipRateLimit(req: Request): boolean {
  // Skip health check endpoints
  if (req.path.startsWith('/health') || req.path.startsWith('/metrics')) {
    return true;
  }

  // Skip internal service calls with valid service token
  const serviceToken = req.headers['x-service-token'];
  if (serviceToken && isValidServiceToken(serviceToken)) {
    return true;
  }

  // Skip whitelisted IPs
  const clientIp = getClientIp(req);
  if (isWhitelistedIp(clientIp)) {
    return true;
  }

  return false;
}

/**
 * Gets client IP address considering proxy headers
 * @param req Express request object
 * @returns Client IP address
 */
function getClientIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    return (typeof forwardedFor === 'string' ? forwardedFor : forwardedFor[0]).split(',')[0];
  }
  return req.ip;
}

/**
 * Validates service-to-service authentication token
 * @param token Service token to validate
 * @returns boolean indicating if token is valid
 */
function isValidServiceToken(token: string | string[]): boolean {
  const serviceToken = Array.isArray(token) ? token[0] : token;
  // Implement service token validation logic
  return serviceToken === process.env.INTERNAL_SERVICE_TOKEN;
}

/**
 * Checks if IP is in whitelist
 * @param ip IP address to check
 * @returns boolean indicating if IP is whitelisted
 */
function isWhitelistedIp(ip: string): boolean {
  const whitelistedIps = ['127.0.0.1', '::1'];
  const whitelistedRanges = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];

  if (whitelistedIps.includes(ip)) {
    return true;
  }

  // Check CIDR ranges
  return whitelistedRanges.some(range => {
    const [subnet, bits] = range.split('/');
    const ipLong = ipToLong(ip);
    const subnetLong = ipToLong(subnet);
    const mask = ~((1 << (32 - parseInt(bits))) - 1);
    return (ipLong & mask) === (subnetLong & mask);
  });
}

/**
 * Converts IP address to long number for CIDR comparison
 * @param ip IP address to convert
 * @returns Long number representation of IP
 */
function ipToLong(ip: string): number {
  return ip.split('.')
    .reduce((long, octet) => (long << 8) + parseInt(octet), 0) >>> 0;
}

/**
 * Handles rate limiting errors with appropriate logging and monitoring
 * @param error Error to handle
 */
function handleRateLimitError(error: RateLimiterError): void {
  logger.error('Rate limiting error', {
    code: error.code,
    message: error.message,
    timestamp: new Date().toISOString()
  });

  // Update error metrics for monitoring
  // Implementation would depend on monitoring system
}

// Export configured rate limiter middleware
export const rateLimiter = createRateLimiter();