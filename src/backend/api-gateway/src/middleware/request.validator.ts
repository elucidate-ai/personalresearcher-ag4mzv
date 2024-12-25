import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import Joi from 'joi'; // ^17.9.0
import { StatusCodes } from 'http-status-codes'; // ^2.3.0
import { ApiError } from './error.handler';
import { logger } from '../utils/logger';

/**
 * Interface defining validation schema structure for different request parts
 */
export interface ValidationSchema {
  body?: Joi.Schema;
  query?: Joi.Schema;
  params?: Joi.Schema;
  headers?: Joi.Schema;
}

/**
 * Interface for validation options with caching support
 */
interface ValidationOptions {
  abortEarly: boolean;
  allowUnknown: boolean;
  stripUnknown: boolean;
  cache: boolean;
  debug?: boolean;
}

/**
 * Default validation options following security best practices
 */
const DEFAULT_VALIDATION_OPTIONS: ValidationOptions = {
  abortEarly: false, // Return all errors instead of stopping at first error
  allowUnknown: false, // Don't allow unknown fields (strict validation)
  stripUnknown: true, // Remove unknown fields from validated data
  cache: true, // Enable validation caching for performance
  debug: process.env.NODE_ENV !== 'production'
};

/**
 * Cache TTL in milliseconds for validation results
 */
const VALIDATION_CACHE_TTL = 3600000; // 1 hour

/**
 * Cache for storing validation results
 */
const validationCache = new Map<string, {
  result: any;
  timestamp: number;
}>();

/**
 * Generates a cache key for validation results
 */
function generateCacheKey(schema: Joi.Schema, data: any): string {
  return `${schema.$_id || schema._flags.id || ''}-${JSON.stringify(data)}`;
}

/**
 * Validates data against a schema with caching support
 */
async function validateWithCache(
  data: any,
  schema: Joi.Schema,
  options: ValidationOptions
): Promise<Joi.ValidationResult> {
  if (!options.cache) {
    return schema.validateAsync(data, options);
  }

  const cacheKey = generateCacheKey(schema, data);
  const cached = validationCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp) < VALIDATION_CACHE_TTL) {
    return cached.result;
  }

  const result = await schema.validateAsync(data, options);
  validationCache.set(cacheKey, {
    result,
    timestamp: Date.now()
  });

  return result;
}

/**
 * Factory function that creates request validation middleware
 * @param schema - Validation schema for request parts
 * @param options - Optional validation options
 */
export function validateRequest(
  schema: ValidationSchema,
  options: Partial<ValidationOptions> = {}
) {
  const validationOptions: ValidationOptions = {
    ...DEFAULT_VALIDATION_OPTIONS,
    ...options
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validationPromises: Promise<any>[] = [];
      const validationErrors: Joi.ValidationError[] = [];

      // Validate request body if schema provided
      if (schema.body) {
        validationPromises.push(
          validateWithCache(req.body, schema.body, validationOptions)
            .then(value => { req.body = value; })
            .catch(err => validationErrors.push(err))
        );
      }

      // Validate query parameters if schema provided
      if (schema.query) {
        validationPromises.push(
          validateWithCache(req.query, schema.query, validationOptions)
            .then(value => { req.query = value; })
            .catch(err => validationErrors.push(err))
        );
      }

      // Validate URL parameters if schema provided
      if (schema.params) {
        validationPromises.push(
          validateWithCache(req.params, schema.params, validationOptions)
            .then(value => { req.params = value; })
            .catch(err => validationErrors.push(err))
        );
      }

      // Validate headers if schema provided
      if (schema.headers) {
        validationPromises.push(
          validateWithCache(req.headers, schema.headers, validationOptions)
            .then(value => { /* Headers are read-only */ })
            .catch(err => validationErrors.push(err))
        );
      }

      // Wait for all validations to complete
      await Promise.all(validationPromises);

      // If there are validation errors, combine them and throw
      if (validationErrors.length > 0) {
        const details = validationErrors.flatMap(err => 
          err.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            type: detail.type
          }))
        );

        // Log validation failure with request context
        logger.warn('Request validation failed', {
          path: req.path,
          method: req.method,
          errors: details,
          correlationId: req.headers['x-correlation-id']
        });

        throw new ApiError(
          'Validation failed',
          StatusCodes.BAD_REQUEST,
          'VALIDATION_ERROR',
          {
            details,
            correlationId: req.headers['x-correlation-id']
          }
        );
      }

      // Validation successful
      if (validationOptions.debug) {
        logger.debug('Request validation successful', {
          path: req.path,
          method: req.method,
          correlationId: req.headers['x-correlation-id']
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Cleans the validation cache
 */
export function clearValidationCache(): void {
  validationCache.clear();
}

/**
 * Gets the current size of the validation cache
 */
export function getValidationCacheSize(): number {
  return validationCache.size;
}

// Export validation options type for external use
export type { ValidationOptions };