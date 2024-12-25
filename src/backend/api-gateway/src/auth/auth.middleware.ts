import { Request, Response, NextFunction } from 'express'; // ^4.18.2
import rateLimit from 'express-rate-limit'; // ^7.1.0
import { JwtService } from './jwt.service';
import { ApiError } from '../middleware/error.handler';
import logger from '../utils/logger';
import { ErrorType } from '../types';

// Types for enhanced request object
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        roles: string[];
        [key: string]: any;
      };
      correlationId?: string;
    }
  }
}

// Rate limiting configuration for authentication endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Authentication middleware with enhanced security features
 * Validates JWT tokens and implements comprehensive security monitoring
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Generate correlation ID for request tracking
    const correlationId = `auth-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    req.correlationId = correlationId;

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new ApiError(
        'No token provided',
        401,
        ErrorType.UNAUTHORIZED,
        { correlationId }
      );
    }

    const token = authHeader.split(' ')[1];
    const fingerprint = req.headers['x-token-fingerprint'] as string;

    // Log authentication attempt
    logger.info({
      message: 'Authentication attempt',
      correlationId,
      ip: req.ip,
      path: req.path,
      method: req.method,
    });

    // Initialize JWT service
    const jwtService = new JwtService();

    // Verify token and extract user data
    const user = await jwtService.verifyToken(token, fingerprint);

    // Attach user data to request
    req.user = user;

    // Set security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Correlation-ID', correlationId);

    // Log successful authentication
    logger.info({
      message: 'Authentication successful',
      correlationId,
      userId: user.userId,
      roles: user.roles,
    });

    next();
  } catch (error) {
    // Log authentication failure
    logger.error({
      message: 'Authentication failed',
      correlationId: req.correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.path,
      method: req.method,
    });

    // Handle specific error types
    if (error instanceof ApiError) {
      next(error);
    } else {
      next(new ApiError(
        'Authentication failed',
        401,
        ErrorType.UNAUTHORIZED,
        { correlationId: req.correlationId }
      ));
    }
  }
}

/**
 * Role-based authorization middleware with audit logging
 * @param allowedRoles Array of roles allowed to access the resource
 */
export function authorize(allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { user, correlationId } = req;

      // Verify user object exists
      if (!user) {
        throw new ApiError(
          'User not authenticated',
          401,
          ErrorType.UNAUTHORIZED,
          { correlationId }
        );
      }

      // Check if user has required role
      const hasRequiredRole = user.roles.some(role => allowedRoles.includes(role));

      // Log authorization attempt
      logger.info({
        message: 'Authorization attempt',
        correlationId,
        userId: user.userId,
        roles: user.roles,
        requiredRoles: allowedRoles,
        authorized: hasRequiredRole,
        path: req.path,
        method: req.method,
      });

      if (!hasRequiredRole) {
        throw new ApiError(
          'Insufficient permissions',
          403,
          ErrorType.FORBIDDEN,
          { correlationId }
        );
      }

      next();
    } catch (error) {
      // Log authorization failure
      logger.error({
        message: 'Authorization failed',
        correlationId: req.correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        path: req.path,
        method: req.method,
      });

      if (error instanceof ApiError) {
        next(error);
      } else {
        next(new ApiError(
          'Authorization failed',
          403,
          ErrorType.FORBIDDEN,
          { correlationId: req.correlationId }
        ));
      }
    }
  };
}

// Export security utilities
export const SecurityHeaders = {
  CONTENT_TYPE_OPTIONS: 'X-Content-Type-Options',
  FRAME_OPTIONS: 'X-Frame-Options',
  XSS_PROTECTION: 'X-XSS-Protection',
  CORRELATION_ID: 'X-Correlation-ID',
  TOKEN_FINGERPRINT: 'X-Token-Fingerprint',
};
```

This implementation provides:

1. JWT token validation with fingerprint verification
2. Role-based access control with detailed audit logging
3. Rate limiting for authentication endpoints
4. Comprehensive security headers
5. Correlation ID tracking for request tracing
6. Detailed error handling with secure error messages
7. Extensive logging for security monitoring
8. TypeScript type safety with enhanced request types

The code follows enterprise security best practices and implements all requirements from the technical specification, including:
- Authentication flow with JWT validation
- Authorization matrix with role-based access
- Security controls with token fingerprinting
- Error handling with correlation IDs
- Security monitoring with detailed logging

The middleware can be used in routes like this:

```typescript
router.get('/protected',
  authenticate,
  authorize(['admin', 'user']),
  protectedRouteHandler
);