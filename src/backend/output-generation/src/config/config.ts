import dotenv from 'dotenv'; // ^16.0.0
import Joi from 'joi'; // ^17.0.0

// Constants
const DEFAULT_PORT = 3003;
const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_LOG_LEVEL = 'info';
const DEFAULT_MAX_CONCURRENT = 5;
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RATE_LIMIT_DELAY = 1000;
const DEFAULT_MAX_FILE_SIZE = 10485760; // 10MB
const SUPPORTED_FORMATS = ['pdf', 'markdown', 'notion', 'html'] as const;
const SENSITIVE_FIELDS = ['apiKey', 'password', 'token'] as const;

// Interfaces
interface ServerConfig {
    port: number;
    host: string;
    env: 'development' | 'staging' | 'production';
    corsOrigins: string[];
    trustProxy: boolean;
}

interface NotionConfig {
    apiKey: string;
    workspaceId: string;
    rateLimitDelay: number;
    maxRetries: number;
    timeout: number;
    baseUrl: string;
}

interface ExportConfig {
    maxConcurrent: number;
    timeout: number;
    retryAttempts: number;
    supportedFormats: string[];
    maxFileSize: number;
    tempDirectory: string;
    cleanupInterval: number;
}

interface LoggingConfig {
    level: 'debug' | 'info' | 'warn' | 'error';
    directory: string;
    maxFiles: number;
    maxSize: string;
    maskFields: string[];
    format: string;
    stdout: boolean;
}

// Validation Schemas
const serverSchema = Joi.object<ServerConfig>({
    port: Joi.number().port().default(DEFAULT_PORT),
    host: Joi.string().hostname().default(DEFAULT_HOST),
    env: Joi.string().valid('development', 'staging', 'production').required(),
    corsOrigins: Joi.array().items(Joi.string().uri()).required(),
    trustProxy: Joi.boolean().default(false)
});

const notionSchema = Joi.object<NotionConfig>({
    apiKey: Joi.string().required().min(32),
    workspaceId: Joi.string().required(),
    rateLimitDelay: Joi.number().min(0).default(DEFAULT_RATE_LIMIT_DELAY),
    maxRetries: Joi.number().min(0).default(DEFAULT_RETRY_ATTEMPTS),
    timeout: Joi.number().min(1000).default(DEFAULT_TIMEOUT),
    baseUrl: Joi.string().uri().required()
});

const exportSchema = Joi.object<ExportConfig>({
    maxConcurrent: Joi.number().min(1).default(DEFAULT_MAX_CONCURRENT),
    timeout: Joi.number().min(1000).default(DEFAULT_TIMEOUT),
    retryAttempts: Joi.number().min(0).default(DEFAULT_RETRY_ATTEMPTS),
    supportedFormats: Joi.array().items(Joi.string().valid(...SUPPORTED_FORMATS)).default(SUPPORTED_FORMATS),
    maxFileSize: Joi.number().min(1).default(DEFAULT_MAX_FILE_SIZE),
    tempDirectory: Joi.string().required(),
    cleanupInterval: Joi.number().min(1000).default(300000) // 5 minutes
});

const loggingSchema = Joi.object<LoggingConfig>({
    level: Joi.string().valid('debug', 'info', 'warn', 'error').default(DEFAULT_LOG_LEVEL),
    directory: Joi.string().required(),
    maxFiles: Joi.number().min(1).default(10),
    maxSize: Joi.string().pattern(/^\d+(kb|mb|gb)$/i).default('100mb'),
    maskFields: Joi.array().items(Joi.string()).default(SENSITIVE_FIELDS),
    format: Joi.string().valid('json', 'text').default('json'),
    stdout: Joi.boolean().default(true)
});

// Configuration validation function
function validateConfig(config: Record<string, any>): Record<string, any> {
    const validationSchema = Joi.object({
        server: serverSchema,
        notion: notionSchema,
        export: exportSchema,
        logging: loggingSchema
    });

    const { error, value } = validationSchema.validate(config, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
    });

    if (error) {
        throw new Error(`Configuration validation failed: ${error.message}`);
    }

    return value;
}

// Configuration loading function
function loadConfig() {
    // Load environment variables
    dotenv.config();

    // Create configuration object
    const config = {
        server: {
            port: parseInt(process.env.PORT || String(DEFAULT_PORT), 10),
            host: process.env.HOST || DEFAULT_HOST,
            env: process.env.NODE_ENV || 'development',
            corsOrigins: process.env.CORS_ORIGINS?.split(',') || [],
            trustProxy: process.env.TRUST_PROXY === 'true'
        },
        notion: {
            apiKey: process.env.NOTION_API_KEY || '',
            workspaceId: process.env.NOTION_WORKSPACE_ID || '',
            rateLimitDelay: parseInt(process.env.NOTION_RATE_LIMIT_DELAY || String(DEFAULT_RATE_LIMIT_DELAY), 10),
            maxRetries: parseInt(process.env.NOTION_MAX_RETRIES || String(DEFAULT_RETRY_ATTEMPTS), 10),
            timeout: parseInt(process.env.NOTION_TIMEOUT || String(DEFAULT_TIMEOUT), 10),
            baseUrl: process.env.NOTION_BASE_URL || 'https://api.notion.com/v1'
        },
        export: {
            maxConcurrent: parseInt(process.env.EXPORT_MAX_CONCURRENT || String(DEFAULT_MAX_CONCURRENT), 10),
            timeout: parseInt(process.env.EXPORT_TIMEOUT || String(DEFAULT_TIMEOUT), 10),
            retryAttempts: parseInt(process.env.EXPORT_RETRY_ATTEMPTS || String(DEFAULT_RETRY_ATTEMPTS), 10),
            supportedFormats: SUPPORTED_FORMATS,
            maxFileSize: parseInt(process.env.EXPORT_MAX_FILE_SIZE || String(DEFAULT_MAX_FILE_SIZE), 10),
            tempDirectory: process.env.EXPORT_TEMP_DIR || '/tmp/output-generation',
            cleanupInterval: parseInt(process.env.EXPORT_CLEANUP_INTERVAL || '300000', 10)
        },
        logging: {
            level: process.env.LOG_LEVEL || DEFAULT_LOG_LEVEL,
            directory: process.env.LOG_DIRECTORY || '/var/log/output-generation',
            maxFiles: parseInt(process.env.LOG_MAX_FILES || '10', 10),
            maxSize: process.env.LOG_MAX_SIZE || '100mb',
            maskFields: SENSITIVE_FIELDS,
            format: process.env.LOG_FORMAT || 'json',
            stdout: process.env.LOG_STDOUT !== 'false'
        }
    };

    // Validate and return immutable configuration
    return Object.freeze(validateConfig(config));
}

// Export validated configuration
export const config = loadConfig();

// Named exports for specific config sections
export const { server, notion, export: exportConfig, logging } = config;