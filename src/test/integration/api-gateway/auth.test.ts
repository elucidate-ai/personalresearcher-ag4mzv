import { describe, beforeAll, afterAll, it, expect, beforeEach, afterEach } from '@jest/globals'; // v29.x
import request from 'supertest'; // v6.x
import { v4 as uuid } from 'uuid'; // v9.x
import { setupTestEnvironment, teardownTestEnvironment } from '../../utils/test-helpers';
import { authenticate } from '../../../backend/api-gateway/src/auth/auth.middleware';
import { JwtService } from '../../../backend/api-gateway/src/auth/jwt.service';

// Constants for test configuration
const TEST_TIMEOUT = 30000;
const RATE_LIMIT_WINDOW = 60000;
const MAX_REQUESTS_PER_WINDOW = 1000;

// Test user data
const testUsers = {
  admin: {
    userId: uuid(),
    roles: ['admin'],
    permissions: ['read', 'write', 'delete']
  },
  user: {
    userId: uuid(),
    roles: ['user'],
    permissions: ['read']
  },
  guest: {
    userId: uuid(),
    roles: ['guest'],
    permissions: []
  }
};

describe('API Gateway Authentication', () => {
  let jwtService: JwtService;
  let app: any;

  beforeAll(async () => {
    // Setup test environment with security configuration
    await setupTestEnvironment({
      securityConfig: {
        jwtSecret: 'test-secret',
        tokenExpiry: '1h',
        issuer: 'test-issuer',
        audience: 'test-audience'
      }
    });
    jwtService = new JwtService();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  beforeEach(() => {
    // Reset rate limiting and token blacklist before each test
    process.env.RATE_LIMIT_WINDOW_MS = String(RATE_LIMIT_WINDOW);
    process.env.MAX_REQUESTS_PER_WINDOW = String(MAX_REQUESTS_PER_WINDOW);
  });

  describe('JWT Token Authentication', () => {
    it('should authenticate valid JWT token with correlation ID', async () => {
      // Generate test token
      const correlationId = uuid();
      const { token, fingerprint } = await jwtService.generateToken(testUsers.user);

      const response = await request(app)
        .get('/api/test')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Token-Fingerprint', fingerprint)
        .set('X-Correlation-ID', correlationId);

      expect(response.status).toBe(200);
      expect(response.headers['x-correlation-id']).toBe(correlationId);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });

    it('should reject expired JWT token with proper logging', async () => {
      // Generate expired token
      const expiredToken = await generateTestToken(testUsers.user, { expiresIn: '0s' });

      const response = await request(app)
        .get('/api/test')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token has expired');
      expect(response.body.metadata.code).toBe('UNAUTHORIZED');
    });

    it('should reject token with invalid fingerprint', async () => {
      const { token } = await jwtService.generateToken(testUsers.user);
      const invalidFingerprint = 'invalid-fingerprint';

      const response = await request(app)
        .get('/api/test')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Token-Fingerprint', invalidFingerprint);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token fingerprint');
    });
  });

  describe('Role-Based Access Control', () => {
    it('should allow access for authorized roles', async () => {
      const { token, fingerprint } = await jwtService.generateToken(testUsers.admin);

      const response = await request(app)
        .get('/api/admin/resource')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Token-Fingerprint', fingerprint);

      expect(response.status).toBe(200);
    });

    it('should deny access for unauthorized roles', async () => {
      const { token, fingerprint } = await jwtService.generateToken(testUsers.guest);

      const response = await request(app)
        .get('/api/admin/resource')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Token-Fingerprint', fingerprint);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Insufficient permissions');
    });

    it('should handle multiple role permissions correctly', async () => {
      const { token, fingerprint } = await jwtService.generateToken({
        ...testUsers.user,
        roles: ['user', 'editor']
      });

      const response = await request(app)
        .get('/api/content/edit')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Token-Fingerprint', fingerprint);

      expect(response.status).toBe(200);
    });
  });

  describe('Security Controls', () => {
    it('should enforce rate limiting', async () => {
      const { token, fingerprint } = await jwtService.generateToken(testUsers.user);
      const requests = Array(MAX_REQUESTS_PER_WINDOW + 1).fill(null);

      for (const [index, _] of requests.entries()) {
        const response = await request(app)
          .get('/api/test')
          .set('Authorization', `Bearer ${token}`)
          .set('X-Token-Fingerprint', fingerprint);

        if (index < MAX_REQUESTS_PER_WINDOW) {
          expect(response.status).toBe(200);
        } else {
          expect(response.status).toBe(429);
          expect(response.body.error).toBe('Too many requests, please try again later');
        }
      }
    });

    it('should handle token blacklisting', async () => {
      const { token, fingerprint } = await jwtService.generateToken(testUsers.user);

      // First request should succeed
      const response1 = await request(app)
        .get('/api/test')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Token-Fingerprint', fingerprint);

      expect(response1.status).toBe(200);

      // Blacklist the token
      await jwtService.revokeToken(token);

      // Subsequent request should fail
      const response2 = await request(app)
        .get('/api/test')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Token-Fingerprint', fingerprint);

      expect(response2.status).toBe(401);
      expect(response2.body.error).toBe('Token has been revoked');
    });

    it('should validate security headers', async () => {
      const { token, fingerprint } = await jwtService.generateToken(testUsers.user);

      const response = await request(app)
        .get('/api/test')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Token-Fingerprint', fingerprint);

      expect(response.headers).toMatchObject({
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'x-xss-protection': '1; mode=block'
      });
    });
  });
});

// Helper function to generate test tokens
async function generateTestToken(
  userData: typeof testUsers.user,
  securityOptions: { expiresIn?: string } = {}
): Promise<string> {
  const correlationId = uuid();
  const jwtService = new JwtService();
  
  const { token } = await jwtService.generateToken({
    ...userData,
    correlationId
  }, securityOptions);

  return token;
}