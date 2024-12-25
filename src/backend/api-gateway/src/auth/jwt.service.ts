import { injectable } from 'inversify';
import jwt from 'jsonwebtoken'; // ^9.0.0
import createError from 'http-errors'; // ^2.0.0
import crypto from 'crypto';
import { auth } from '../config/config';

// Types for JWT service
interface UserPayload {
  userId: string;
  roles: string[];
  [key: string]: any;
}

interface TokenOptions {
  expiresIn?: string;
  refreshToken?: boolean;
}

interface TokenResponse {
  token: string;
  fingerprint: string;
  expiresIn: number;
}

interface JWTClaims extends UserPayload {
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  jti: string;
  fgp: string; // Token fingerprint
}

@injectable()
export class JwtService {
  private readonly jwtPrivateKey: string;
  private readonly jwtPublicKey: string;
  private readonly tokenExpiry: string;
  private readonly refreshTokenExpiry: string;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly tokenBlacklist: Set<string>;

  constructor() {
    // Initialize JWT configuration from auth config
    this.jwtPrivateKey = auth.jwtSecret;
    this.jwtPublicKey = auth.jwtSecret; // In production, use separate public key
    this.tokenExpiry = auth.tokenExpiry;
    this.refreshTokenExpiry = auth.refreshTokenExpiry;
    this.issuer = auth.issuer;
    this.audience = auth.audience;
    this.tokenBlacklist = new Set<string>();

    // Validate required configuration
    if (!this.jwtPrivateKey || !this.issuer || !this.audience) {
      throw new Error('JWT configuration is incomplete');
    }
  }

  /**
   * Generates a secure token fingerprint
   * @returns Generated fingerprint hash
   */
  private generateFingerprint(): string {
    const randomBytes = crypto.randomBytes(32);
    return crypto
      .createHash('sha256')
      .update(randomBytes)
      .digest('hex');
  }

  /**
   * Creates JWT token with enhanced security features
   * @param payload User payload data
   * @param options Token generation options
   * @returns Token response with fingerprint
   */
  public async generateToken(
    payload: UserPayload,
    options: TokenOptions = {}
  ): Promise<TokenResponse> {
    try {
      // Generate unique fingerprint for token binding
      const fingerprint = this.generateFingerprint();
      
      // Calculate expiration time
      const expiresIn = options.refreshToken 
        ? this.refreshTokenExpiry 
        : this.tokenExpiry;
      
      // Create complete JWT claims
      const claims: JWTClaims = {
        ...payload,
        iss: this.issuer,
        aud: this.audience,
        exp: Math.floor(Date.now() / 1000) + parseInt(expiresIn),
        iat: Math.floor(Date.now() / 1000),
        jti: crypto.randomUUID(),
        fgp: fingerprint
      };

      // Sign token with RSA-256
      const token = jwt.sign(claims, this.jwtPrivateKey, {
        algorithm: 'RS256',
        expiresIn
      });

      return {
        token,
        fingerprint,
        expiresIn: parseInt(expiresIn)
      };
    } catch (error) {
      throw createError(500, 'Error generating JWT token');
    }
  }

  /**
   * Verifies JWT token with comprehensive security checks
   * @param token JWT token to verify
   * @param fingerprint Token fingerprint for validation
   * @returns Decoded token payload
   */
  public async verifyToken(
    token: string,
    fingerprint: string
  ): Promise<UserPayload> {
    try {
      // Check token blacklist
      if (this.tokenBlacklist.has(token)) {
        throw createError(401, 'Token has been revoked');
      }

      // Verify token signature and claims
      const decoded = jwt.verify(token, this.jwtPublicKey, {
        algorithms: ['RS256'],
        issuer: this.issuer,
        audience: this.audience
      }) as JWTClaims;

      // Verify token fingerprint
      if (decoded.fgp !== fingerprint) {
        throw createError(401, 'Invalid token fingerprint');
      }

      // Extract user payload from claims
      const { iss, aud, exp, iat, jti, fgp, ...userPayload } = decoded;

      return userPayload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw createError(401, 'Invalid token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw createError(401, 'Token has expired');
      }
      throw error;
    }
  }

  /**
   * Implements secure token rotation
   * @param oldToken Current token to rotate
   * @param fingerprint Current token fingerprint
   * @returns New token response
   */
  public async refreshToken(
    oldToken: string,
    fingerprint: string
  ): Promise<TokenResponse> {
    try {
      // Verify current token
      const payload = await this.verifyToken(oldToken, fingerprint);

      // Blacklist old token
      this.tokenBlacklist.add(oldToken);

      // Generate new token with same payload
      return this.generateToken(payload, { refreshToken: true });
    } catch (error) {
      throw createError(401, 'Invalid refresh token');
    }
  }

  /**
   * Revokes a token by adding it to blacklist
   * @param token Token to revoke
   */
  public revokeToken(token: string): void {
    this.tokenBlacklist.add(token);
  }

  /**
   * Cleans up expired tokens from blacklist
   * Should be called periodically
   */
  private cleanupBlacklist(): void {
    for (const token of this.tokenBlacklist) {
      try {
        jwt.verify(token, this.jwtPublicKey);
      } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
          this.tokenBlacklist.delete(token);
        }
      }
    }
  }
}