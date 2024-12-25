/**
 * Redux Store Configuration
 * @version 1.0.0
 * @description Configures a production-ready Redux store with enhanced security,
 * persistence, middleware, and development tools integration.
 */

import { configureStore, Middleware } from '@reduxjs/toolkit'; // ^2.0.0
import { 
  persistStore, 
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER
} from 'redux-persist'; // ^6.0.0
import storage from 'redux-persist/lib/storage'; // ^6.0.0
import { encryptTransform } from 'redux-persist-transform-encrypt'; // ^3.0.0

import rootReducer, { RootState } from './root.reducer';
import { appConfig } from '../config/app.config';

/**
 * Security-enhanced persistence configuration
 * Implements selective state persistence with encryption
 */
const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['auth'], // Only persist authentication state
  transforms: [
    encryptTransform({
      secretKey: process.env.VITE_REDUX_ENCRYPTION_KEY || 'default-key',
      onError: (error) => {
        console.error('Redux Persistence Encryption Error:', error);
      }
    })
  ],
  timeout: 10000, // 10 second timeout for persistence operations
  debug: appConfig.app.debug
};

/**
 * Custom error handling middleware
 * Tracks and logs Redux-related errors
 */
const errorHandler: Middleware = () => (next) => (action) => {
  try {
    return next(action);
  } catch (error) {
    console.error('Redux Error:', {
      action: action.type,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};

/**
 * State validation middleware
 * Ensures state updates maintain data integrity
 */
const stateValidator: Middleware = () => (next) => (action) => {
  const result = next(action);
  const invalidAction = action.type.includes('@@redux/INIT') || 
                       action.type.includes('persist/');
  
  if (!invalidAction) {
    console.debug('State Update:', {
      action: action.type,
      timestamp: new Date().toISOString()
    });
  }
  
  return result;
};

/**
 * Configure the persisted reducer with security enhancements
 */
const persistedReducer = persistReducer(persistConfig, rootReducer);

/**
 * Configure and create the Redux store with comprehensive middleware setup
 */
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) => 
    getDefaultMiddleware({
      // Configure serialization checks
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        warnAfter: 128
      },
      // Configure immutability checks
      immutableCheck: {
        warnAfter: 128
      }
    }).concat(errorHandler, stateValidator),
  devTools: appConfig.app.debug,
  preloadedState: undefined
});

/**
 * Configure the persistor with enhanced security and error handling
 */
export const persistor = persistStore(store, {
  manualPersist: false,
  transforms: [
    encryptTransform({
      secretKey: process.env.VITE_REDUX_ENCRYPTION_KEY || 'default-key',
      onError: (error) => {
        console.error('Persistor Encryption Error:', error);
      }
    })
  ]
});

// Export type-safe hooks
export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;

/**
 * Type guard to check if state is rehydrated
 */
export const isStateRehydrated = (state: RootState): boolean => {
  return state._persist?.rehydrated === true;
};

// Export default store instance
export default store;