/**
 * Application Entry Point
 * @version 1.0.0
 * @description Initializes the React application with enhanced security, monitoring,
 * and performance features while ensuring proper cleanup and development tools.
 */

import React from 'react'; // ^18.0.0
import ReactDOM from 'react-dom/client'; // ^18.0.0
import * as Sentry from '@sentry/react'; // ^7.0.0
import App from './App';

// Import global styles
import './assets/styles/global.css';
import './assets/styles/tailwind.css';

/**
 * Initialize Sentry error monitoring with environment-specific configuration
 */
const initializeSentry = () => {
  if (process.env.NODE_ENV === 'production' && process.env.VITE_SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.VITE_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      release: process.env.VITE_APP_VERSION,
      integrations: [
        new Sentry.BrowserTracing({
          tracePropagationTargets: ['localhost', /^https:\/\/[^/]+\.knowledge-curator\.com/],
        }),
      ],
      tracesSampleRate: 0.1,
      beforeSend(event) {
        // Sanitize sensitive data before sending
        if (event.request) {
          delete event.request.cookies;
          delete event.request.headers;
        }
        return event;
      },
    });
  }
};

/**
 * Initialize performance monitoring
 */
const initializePerformanceMonitoring = () => {
  if (process.env.NODE_ENV === 'production') {
    // Monitor long tasks
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.duration > 50) { // 50ms threshold
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
  }
};

/**
 * Cleanup function to handle application unmounting
 */
const cleanup = () => {
  // Flush any pending error reports
  Sentry.flush().catch(() => {
    console.error('Failed to flush Sentry events');
  });

  // Clear any intervals or subscriptions
  window.removeEventListener('unhandledrejection', handleUnhandledRejection);
};

/**
 * Handle unhandled promise rejections
 */
const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
  console.error('Unhandled Promise Rejection:', event.reason);
  Sentry.captureException(event.reason);
  event.preventDefault();
};

/**
 * Initialize and render the application
 */
const renderApp = () => {
  // Verify root element exists
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  // Initialize monitoring and error tracking
  initializeSentry();
  initializePerformanceMonitoring();

  // Set up global error handling
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  // Create React root with concurrent features
  const root = ReactDOM.createRoot(rootElement);

  // Render application with strict mode and error boundary
  root.render(
    <React.StrictMode>
      <Sentry.ErrorBoundary
        fallback={({ error }) => (
          <div role="alert" className="container-responsive p-responsive">
            <h2 className="text-xl font-semibold text-error mb-4">
              Something went wrong
            </h2>
            <pre className="text-sm bg-gray-100 p-4 rounded-lg overflow-auto">
              {error.message}
            </pre>
          </div>
        )}
      >
        <App />
      </Sentry.ErrorBoundary>
    </React.StrictMode>
  );

  // Set up cleanup on unmount
  return () => {
    cleanup();
    root.unmount();
  };
};

// Initialize the application
renderApp();

// Enable HMR in development
if (import.meta.hot) {
  import.meta.hot.accept();
}