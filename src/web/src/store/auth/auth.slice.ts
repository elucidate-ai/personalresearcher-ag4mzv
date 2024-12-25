/**
 * Enhanced Authentication Redux Slice
 * Implements secure authentication state management with comprehensive security features
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // ^2.0.0
import { AuthState, AuthUser, AuthError, LoginCredentials } from '../../types/auth.types';
import { AuthService } from '../../services/auth.service';
import { AUTH_ERRORS, AUTH_STATES } from '../../constants/auth.constants';

/**
 * Initial authentication state with security metadata
 */
const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  loading: false,
  error: null,
  sessionTimeout: 1800000, // 30 minutes in milliseconds
  lastActivity: Date.now(),
  rateLimitRemaining: 1000,
  securityMetadata: {
    loginAttempts: 0,
    lastLoginAttempt: 0,
    securityEvents: []
  }
};

/**
 * Enhanced async thunk for secure login operation
 */
export const loginAsync = createAsyncThunk(
  'auth/login',
  async (credentials: LoginCredentials, { rejectWithValue, dispatch }) => {
    try {
      // Rate limiting check
      const now = Date.now();
      const authService = new AuthService();

      // Log security event
      await authService.logSecurityEvent('login_attempt', {
        email: credentials.email,
        timestamp: now
      });

      // Validate session and rate limits
      const isValid = await authService.validateSession();
      if (!isValid) {
        throw new Error('Session validation failed');
      }

      // Perform authentication
      const authState = await authService.login(credentials);

      // Update security metadata
      dispatch(updateSecurityMetadata({
        lastLoginAttempt: now,
        loginAttempts: 0
      }));

      return authState;
    } catch (error) {
      return rejectWithValue({
        type: AUTH_ERRORS.UNAUTHORIZED,
        message: error instanceof Error ? error.message : 'Authentication failed',
        code: AUTH_ERRORS.UNAUTHORIZED,
        details: error,
        timestamp: new Date()
      });
    }
  }
);

/**
 * Enhanced async thunk for secure logout operation
 */
export const logoutAsync = createAsyncThunk(
  'auth/logout',
  async (_, { dispatch }) => {
    const authService = new AuthService();
    
    try {
      // Log security event
      await authService.logSecurityEvent('logout_initiated', {
        timestamp: Date.now()
      });

      // Perform logout
      await authService.logout();

      // Clear security state
      dispatch(resetSecurityState());

    } catch (error) {
      await authService.logSecurityEvent('logout_error', {
        error,
        timestamp: Date.now()
      });
      throw error;
    }
  }
);

/**
 * Enhanced async thunk for session validation
 */
export const validateSessionAsync = createAsyncThunk(
  'auth/validateSession',
  async (_, { getState, dispatch }) => {
    const authService = new AuthService();
    const state = getState() as { auth: AuthState };
    const { lastActivity, sessionTimeout } = state.auth;

    try {
      // Check session timeout
      if (Date.now() - lastActivity > sessionTimeout) {
        await authService.logSecurityEvent('session_timeout', {
          lastActivity,
          sessionTimeout
        });
        dispatch(logoutAsync());
        return false;
      }

      // Validate session
      const isValid = await authService.validateSession();
      if (!isValid) {
        await authService.logSecurityEvent('invalid_session', {
          timestamp: Date.now()
        });
        dispatch(logoutAsync());
        return false;
      }

      return true;
    } catch (error) {
      await authService.logSecurityEvent('session_validation_error', {
        error,
        timestamp: Date.now()
      });
      return false;
    }
  }
);

/**
 * Enhanced authentication slice with comprehensive security features
 */
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    updateSecurityMetadata: (state, action: PayloadAction<Partial<typeof state.securityMetadata>>) => {
      state.securityMetadata = {
        ...state.securityMetadata,
        ...action.payload
      };
    },
    updateLastActivity: (state) => {
      state.lastActivity = Date.now();
    },
    decrementRateLimit: (state) => {
      state.rateLimitRemaining = Math.max(0, state.rateLimitRemaining - 1);
    },
    resetSecurityState: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.error = null;
      state.securityMetadata = initialState.securityMetadata;
      state.rateLimitRemaining = initialState.rateLimitRemaining;
    },
    setAuthError: (state, action: PayloadAction<AuthError>) => {
      state.error = action.payload;
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder
      // Login handling
      .addCase(loginAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginAsync.fulfilled, (state, action) => {
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.loading = false;
        state.error = null;
        state.lastActivity = Date.now();
      })
      .addCase(loginAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as AuthError;
        state.securityMetadata.loginAttempts += 1;
      })
      // Logout handling
      .addCase(logoutAsync.fulfilled, (state) => {
        return { ...initialState };
      })
      // Session validation handling
      .addCase(validateSessionAsync.fulfilled, (state, action) => {
        if (!action.payload) {
          return { ...initialState };
        }
        state.lastActivity = Date.now();
      });
  }
});

// Export actions
export const {
  updateSecurityMetadata,
  updateLastActivity,
  decrementRateLimit,
  resetSecurityState,
  setAuthError
} = authSlice.actions;

// Export selector
export const selectAuth = (state: { auth: AuthState }) => state.auth;

// Export reducer
export default authSlice.reducer;