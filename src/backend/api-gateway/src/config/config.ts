import dotenv from 'dotenv'; // ^16.0.0
import Joi from 'joi'; // ^17.9.0

// Configuration type definitions
interface ServiceConfig {
  host: string;
  port: number;
  timeout: number;
  healthCheck: string;
}

interface CorsConfig {
  origin: string[];
  methods: string[];
  credentials: boolean;
  maxAge: number;
  allowedHeaders: string[];
  exposedHeaders: string[];
}

interface AuthConfig {
  jwtSecret: string;
  tokenExpiry: string;
  issuer: string;
  audience: string;
  refreshTokenExpiry: string;
  tokenRotation: boolean;
}

interface RateLimitingConfig {
  windowMs: number;
  maxRequests: number;
  skipFailedRequests: boolean;
  keyGenerator: (req: any) => string;
  handler: (req: any, res: any, next: any) => void;
}

interface LoggingConfig {
  level: string;
  format: string;
  maskFields: string[];
  outputPath: string;
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitorInterval: number;
  healthCheckInterval: number;
}

interface ServicesConfig {
  contentDiscovery: ServiceConfig;
  knowledgeOrganization: ServiceConfig;
  vectorService: ServiceConfig;
  outputGeneration: ServiceConfig;
}

interface ConfigType {
  env: string;
  port: number;
  cors: CorsConfig;
  auth: AuthConfig;
  services: ServicesConfig;
  rateLimiting: RateLimitingConfig;
  logging: LoggingConfig;
  circuitBreaker: CircuitBreakerConfig;
}

// Configuration validation schema
const configSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production')
    .required(),
  PORT: Joi.number().default(3000),
  
  // CORS Configuration
  CORS_ORIGIN: Joi.string().required(),
  CORS_METHODS: Joi.string().default('GET,POST,PUT,DELETE,PATCH'),
  CORS_CREDENTIALS: Joi.boolean().default(true),
  CORS_MAX_AGE: Joi.number().default(86400),
  
  // Authentication Configuration
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRY: Joi.string().default('1h'),
  JWT_ISSUER: Joi.string().required(),
  JWT_AUDIENCE: Joi.string().required(),
  REFRESH_TOKEN_EXPIRY: Joi.string().default('7d'),
  TOKEN_ROTATION: Joi.boolean().default(true),
  
  // Service Endpoints
  CONTENT_DISCOVERY_HOST: Joi.string().required(),
  CONTENT_DISCOVERY_PORT: Joi.number().required(),
  KNOWLEDGE_ORGANIZATION_HOST: Joi.string().required(),
  KNOWLEDGE_ORGANIZATION_PORT: Joi.number().required(),
  VECTOR_SERVICE_HOST: Joi.string().required(),
  VECTOR_SERVICE_PORT: Joi.number().required(),
  OUTPUT_GENERATION_HOST: Joi.string().required(),
  OUTPUT_GENERATION_PORT: Joi.number().required(),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(3600000), // 1 hour
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(1000),
  RATE_LIMIT_SKIP_FAILED: Joi.boolean().default(false),
  
  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_FORMAT: Joi.string().valid('json', 'pretty').default('json'),
  LOG_MASK_FIELDS: Joi.string().default('password,token'),
  LOG_OUTPUT_PATH: Joi.string().default('./logs'),
  
  // Circuit Breaker
  CIRCUIT_BREAKER_THRESHOLD: Joi.number().default(50),
  CIRCUIT_BREAKER_TIMEOUT: Joi.number().default(30000),
  CIRCUIT_BREAKER_MONITOR: Joi.number().default(5000),
  CIRCUIT_BREAKER_HEALTH_CHECK: Joi.number().default(10000),
}).unknown();

// Configuration validation function
function validateConfig(): ConfigType {
  const { error, value: envVars } = configSchema.validate(process.env, {
    abortEarly: false,
  });

  if (error) {
    throw new Error(
      `Configuration validation error: ${error.details.map(d => d.message).join(', ')}`
    );
  }

  const config: ConfigType = {
    env: envVars.NODE_ENV,
    port: envVars.PORT,
    cors: {
      origin: envVars.CORS_ORIGIN.split(','),
      methods: envVars.CORS_METHODS.split(','),
      credentials: envVars.CORS_CREDENTIALS,
      maxAge: envVars.CORS_MAX_AGE,
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
    },
    auth: {
      jwtSecret: envVars.JWT_SECRET,
      tokenExpiry: envVars.JWT_EXPIRY,
      issuer: envVars.JWT_ISSUER,
      audience: envVars.JWT_AUDIENCE,
      refreshTokenExpiry: envVars.REFRESH_TOKEN_EXPIRY,
      tokenRotation: envVars.TOKEN_ROTATION,
    },
    services: {
      contentDiscovery: {
        host: envVars.CONTENT_DISCOVERY_HOST,
        port: envVars.CONTENT_DISCOVERY_PORT,
        timeout: 10000,
        healthCheck: '/health',
      },
      knowledgeOrganization: {
        host: envVars.KNOWLEDGE_ORGANIZATION_HOST,
        port: envVars.KNOWLEDGE_ORGANIZATION_PORT,
        timeout: 10000,
        healthCheck: '/health',
      },
      vectorService: {
        host: envVars.VECTOR_SERVICE_HOST,
        port: envVars.VECTOR_SERVICE_PORT,
        timeout: 15000,
        healthCheck: '/health',
      },
      outputGeneration: {
        host: envVars.OUTPUT_GENERATION_HOST,
        port: envVars.OUTPUT_GENERATION_PORT,
        timeout: 20000,
        healthCheck: '/health',
      },
    },
    rateLimiting: {
      windowMs: envVars.RATE_LIMIT_WINDOW_MS,
      maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS,
      skipFailedRequests: envVars.RATE_LIMIT_SKIP_FAILED,
      keyGenerator: (req: any) => req.ip,
      handler: (req: any, res: any, next: any) => {
        res.status(429).json({
          error: 'Too many requests, please try again later.',
        });
      },
    },
    logging: {
      level: envVars.LOG_LEVEL,
      format: envVars.LOG_FORMAT,
      maskFields: envVars.LOG_MASK_FIELDS.split(','),
      outputPath: envVars.LOG_OUTPUT_PATH,
    },
    circuitBreaker: {
      failureThreshold: envVars.CIRCUIT_BREAKER_THRESHOLD,
      resetTimeout: envVars.CIRCUIT_BREAKER_TIMEOUT,
      monitorInterval: envVars.CIRCUIT_BREAKER_MONITOR,
      healthCheckInterval: envVars.CIRCUIT_BREAKER_HEALTH_CHECK,
    },
  };

  return Object.freeze(config);
}

// Load configuration based on environment
function loadConfig(): ConfigType {
  if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
  }
  
  return validateConfig();
}

// Export frozen configuration object
export const config = loadConfig();

// Export individual configuration sections for convenience
export const {
  env,
  port,
  cors,
  auth,
  services,
  rateLimiting,
  logging,
  circuitBreaker,
} = config;