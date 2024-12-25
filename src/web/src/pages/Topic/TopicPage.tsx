import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Box, Grid, useMediaQuery } from '@mui/material'; // ^5.0.0
import { useTheme } from '@mui/material/styles'; // ^5.0.0
import { ErrorBoundary, withErrorBoundary } from '@sentry/react'; // ^5.0.0

import { TopicExplorer, TopicExplorerProps } from '../../components/topic/TopicExplorer';
import { GraphVisualization, GraphVisualizationProps } from '../../components/graph/GraphVisualization';
import { Topic } from '../../types/topic.types';
import { useTopic } from '../../hooks/useTopic';

// Constants for performance optimization
const VIEWPORT_UPDATE_DEBOUNCE = 100;
const PERFORMANCE_MONITOR_SAMPLE_RATE = 0.1;

// Styled container with accessibility support
const StyledContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  padding: theme.spacing(3),
  backgroundColor: theme.palette.background.default,
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
  },
  // Ensure proper focus management
  '&:focus': {
    outline: 'none',
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
}));

// Error fallback component
const ErrorFallback = ({ error, resetError }: { error: Error; resetError: () => void }) => (
  <Box
    role="alert"
    p={3}
    display="flex"
    flexDirection="column"
    alignItems="center"
    gap={2}
  >
    <Typography variant="h6" color="error">
      An error occurred while loading the topic page
    </Typography>
    <Typography variant="body2" color="text.secondary">
      {error.message}
    </Typography>
    <Button onClick={resetError} variant="contained">
      Try Again
    </Button>
  </Box>
);

/**
 * TopicPage component providing comprehensive topic exploration interface
 * with enhanced error handling, performance optimization, and accessibility support
 */
const TopicPage: React.FC = withErrorBoundary(() => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const containerRef = useRef<HTMLDivElement>(null);

  // Topic state management
  const {
    topics,
    currentTopic,
    loading,
    error,
    searchTopics,
    getTopicDetails,
    getRelatedTopics,
    clearTopics,
    resetAllErrors,
    retryOperation,
  } = useTopic();

  // WebGL support detection
  const [webGLSupported, setWebGLSupported] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  /**
   * Checks WebGL support and capabilities
   */
  const checkWebGLSupport = useCallback(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      setWebGLSupported(!!gl);
    } catch (error) {
      console.warn('WebGL not supported:', error);
      setWebGLSupported(false);
    }
  }, []);

  /**
   * Enhanced topic selection handler with analytics and error tracking
   */
  const handleTopicSelect = useCallback(async (topic: Topic) => {
    try {
      // Track selection event
      if (process.env.NODE_ENV === 'production') {
        window.gtag?.('event', 'topic_selected', {
          topic_id: topic.id,
          topic_name: topic.name,
        });
      }

      await getTopicDetails(topic.id);
      await getRelatedTopics(topic.id);

      // Update URL with selected topic
      window.history.pushState(
        { topicId: topic.id },
        '',
        `/topics/${topic.id}`
      );
    } catch (error) {
      console.error('Error selecting topic:', error);
      throw error;
    }
  }, [getTopicDetails, getRelatedTopics]);

  /**
   * Updates container dimensions with debouncing
   */
  const updateDimensions = useCallback(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      setDimensions({ width, height });
    }
  }, []);

  // Initialize component
  useEffect(() => {
    checkWebGLSupport();
    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      clearTopics();
      resetAllErrors();
    };
  }, [checkWebGLSupport, updateDimensions, clearTopics, resetAllErrors]);

  return (
    <StyledContainer
      ref={containerRef}
      role="main"
      aria-label="Topic exploration page"
    >
      <Grid container spacing={2} sx={{ height: '100%' }}>
        {/* Topic Explorer Panel */}
        <Grid item xs={12} md={4} lg={3}>
          <TopicExplorer
            onTopicSelect={handleTopicSelect}
            errorBoundary={true}
            analyticsEnabled={process.env.NODE_ENV === 'production'}
          />
        </Grid>

        {/* Knowledge Graph Visualization */}
        <Grid item xs={12} md={8} lg={9}>
          {currentTopic && (
            <GraphVisualization
              topicId={currentTopic.id}
              width={dimensions.width}
              height={dimensions.height}
              useWebGL={webGLSupported}
            />
          )}
        </Grid>
      </Grid>
    </StyledContainer>
  );
}, {
  fallback: ErrorFallback,
  onError: (error) => {
    console.error('TopicPage Error:', error);
    // Send error to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      ErrorTracker.captureException(error);
    }
  }
});

// Display name for debugging
TopicPage.displayName = 'TopicPage';

export default TopicPage;