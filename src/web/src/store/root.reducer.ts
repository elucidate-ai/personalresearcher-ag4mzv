/**
 * Root Redux Reducer Configuration
 * @version 1.0.0
 * @description Combines all feature-specific reducers into a single application state tree
 * with enhanced security monitoring, performance optimization, and strict type safety.
 */

import { combineReducers } from '@reduxjs/toolkit'; // ^2.0.0
import authReducer from './auth/auth.slice';
import contentReducer from './content/content.slice';
import graphReducer from './graph/graph.slice';
import exportReducer from './export/export.slice';

/**
 * Type-safe interface defining the complete application state tree
 * with strict immutability for enhanced security
 */
export interface RootState {
  readonly auth: ReturnType<typeof authReducer>;
  readonly content: ReturnType<typeof contentReducer>;
  readonly graph: ReturnType<typeof graphReducer>;
  readonly export: ReturnType<typeof exportReducer>;
}

/**
 * Performance monitoring decorator for state updates
 * Tracks reducer execution time and state tree size
 */
function performanceMonitor(reducer: any) {
  return (state: any, action: any) => {
    const startTime = performance.now();
    const nextState = reducer(state, action);
    const duration = performance.now() - startTime;

    // Log performance metrics if duration exceeds threshold
    if (duration > 16.67) { // 60fps threshold
      console.warn('Performance Warning:', {
        action: action.type,
        duration,
        timestamp: new Date().toISOString()
      });
    }

    return nextState;
  };
}

/**
 * State validation decorator to ensure data integrity
 * and prevent unauthorized state mutations
 */
function validateState(reducer: any) {
  return (state: any, action: any) => {
    const nextState = reducer(state, action);

    // Ensure immutability
    Object.freeze(nextState);
    Object.keys(nextState).forEach(key => {
      if (typeof nextState[key] === 'object' && nextState[key] !== null) {
        Object.freeze(nextState[key]);
      }
    });

    // Validate state structure
    if (!nextState.auth || !nextState.content || !nextState.graph || !nextState.export) {
      console.error('State Validation Error: Invalid state structure', {
        action: action.type,
        timestamp: new Date().toISOString()
      });
    }

    return nextState;
  };
}

/**
 * Enhanced root reducer with performance monitoring and state validation
 * Combines all feature reducers into a single state tree with type safety
 */
const rootReducer = validateState(
  performanceMonitor(
    combineReducers<RootState>({
      auth: authReducer,
      content: contentReducer,
      graph: graphReducer,
      export: exportReducer
    })
  )
);

export default rootReducer;