/**
 * Root Application Component
 * @version 1.0.0
 * @description Sets up the core application shell with Redux Provider, Router,
 * error boundaries, performance monitoring, and accessibility features.
 */

import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { ErrorBoundary } from 'react-error-boundary';
import Router from './routes/Router';
import store, { persistor } from './store/store';
import Toast from './components/common/Toast';
import LoadingSpinner from './components/common/LoadingSpinner';

// Constants for performance monitoring
const PERFORMANCE_THRESHOLD_MS = 3000;
const ERROR_REPORTING_ENDPOINT = process.env.REACT_APP_ERROR_ENDPOINT;

/**
 * Error fallback component for the error boundary
 */
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <div role="alert" className="container-responsive p-responsive">
    <h2 className="text-xl font-semibold text-error mb-4">
      Something went wrong
    </h2>
    <pre className="text-sm bg-gray-100 p-4 rounded-lg overflow-auto">
      {error.message}
    </pre>
    <button
      onClick={resetErrorBoundary}
      className="btn-primary mt-4"
      aria-label="Try again"
    >
      Try again
    </button>
  </div>
);

/**
 * Loading fallback component for the persist gate
 */
const PersistLoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen">
    <LoadingSpinner size="large" color="primary" />
  </div>
);

/**
 * Root application component that sets up the core application structure
 */
const App: React.FC = () => {
  // Set up performance monitoring
  useEffect(() => {
    // Monitor long tasks
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.duration > PERFORMANCE_THRESHOLD_MS) {
          console.warn('Long Task Detected:', {
            name: entry.name,
            duration: entry.duration,
            startTime: entry.startTime,
            entryType: entry.entryType
          });
        }
      });
    });

    observer.observe({ entryTypes: ['longtask'] });

    // Clean up observer
    return () => observer.disconnect();
  }, []);

  // Handle global errors
  const handleError = (error: Error, info: { componentStack: string }) => {
    console.error('Application Error:', error);
    
    // Report error to monitoring service
    if (ERROR_REPORTING_ENDPOINT) {
      fetch(ERROR_REPORTING_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: error.message,
          stack: error.stack,
          componentStack: info.componentStack,
          timestamp: new Date().toISOString()
        })
      }).catch(console.error);
    }
  };

  return (
    <React.StrictMode>
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onError={handleError}
        onReset={() => window.location.reload()}
      >
        <Provider store={store}>
          <PersistGate
            loading={<PersistLoadingFallback />}
            persistor={persistor}
          >
            <div
              className="app-root"
              role="application"
              aria-label="Knowledge Curator Application"
            >
              {/* Accessibility announcer for route changes */}
              <div
                aria-live="polite"
                aria-atomic="true"
                className="sr-only"
                role="status"
                id="route-announcer"
              />
              
              {/* Main application router */}
              <Router />

              {/* Global toast notifications */}
              <Toast
                type="info"
                message=""
                open={false}
                onClose={() => {}}
                aria-label="Notification"
              />
            </div>
          </PersistGate>
        </Provider>
      </ErrorBoundary>
    </React.StrictMode>
  );
};

export default App;