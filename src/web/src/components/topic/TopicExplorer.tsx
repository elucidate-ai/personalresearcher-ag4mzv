import React, { memo, useCallback, useEffect, useState } from 'react';
import { styled } from '@mui/material/styles'; // ^5.0.0
import { Box, Paper, useMediaQuery } from '@mui/material'; // ^5.0.0
import { useVirtualizer } from '@tanstack/react-virtual'; // ^3.0.0
import debounce from 'lodash/debounce'; // ^4.17.21
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

import TopicList from './TopicList';
import TopicBreadcrumb from './TopicBreadcrumb';
import { Topic } from '../../types/topic.types';
import { useTopic } from '../../hooks/useTopic';

// Constants for performance optimization
const DEBOUNCE_DELAY = 300;
const SCROLL_THRESHOLD = 0.8;
const MINIMUM_SEARCH_LENGTH = 2;

// Interface for component props
export interface TopicExplorerProps {
  onTopicSelect?: (topic: Topic) => void;
  className?: string;
  errorBoundary?: boolean;
  analyticsEnabled?: boolean;
}

// Styled container with responsive design
const StyledContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  padding: theme.spacing(3),
  minHeight: '400px',
  position: 'relative',
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
  },
}));

// Styled content area with proper layout
const ContentArea = styled(Paper)(({ theme }) => ({
  flex: 1,
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.shadows[1],
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
}));

/**
 * Error fallback component for error boundary
 */
const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
  <StyledContainer role="alert">
    <h3>Something went wrong:</h3>
    <pre>{error.message}</pre>
    <button onClick={resetErrorBoundary}>Try again</button>
  </StyledContainer>
);

/**
 * TopicExplorer component providing comprehensive topic exploration interface
 * with enhanced error handling and performance optimizations.
 */
export const TopicExplorer = memo(({
  onTopicSelect,
  className,
  errorBoundary = true,
  analyticsEnabled = false,
}: TopicExplorerProps) => {
  // Hooks and state
  const isMobile = useMediaQuery('(max-width:640px)');
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

  const [topicHierarchy, setTopicHierarchy] = useState<Topic[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Virtual scroll configuration
  const parentRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: topics.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

  // Debounced search implementation
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (query.length >= MINIMUM_SEARCH_LENGTH) {
        try {
          await searchTopics({
            searchQuery: query,
            minRelevanceScore: 90, // 90% relevance threshold requirement
          });
        } catch (error) {
          console.error('Search failed:', error);
        }
      }
    }, DEBOUNCE_DELAY),
    [searchTopics]
  );

  // Handle topic selection with analytics
  const handleTopicSelect = useCallback(async (topic: Topic) => {
    try {
      await getTopicDetails(topic.id);
      await getRelatedTopics(topic.id);
      
      setTopicHierarchy(prev => [...prev, topic]);
      
      if (onTopicSelect) {
        onTopicSelect(topic);
      }

      if (analyticsEnabled) {
        // Track topic selection event
        window.gtag?.('event', 'topic_selected', {
          topic_id: topic.id,
          topic_name: topic.name,
        });
      }
    } catch (error) {
      console.error('Topic selection failed:', error);
    }
  }, [getTopicDetails, getRelatedTopics, onTopicSelect, analyticsEnabled]);

  // Handle breadcrumb navigation
  const handleBreadcrumbNavigation = useCallback(async (topic: Topic) => {
    try {
      await getTopicDetails(topic.id);
      const index = topicHierarchy.findIndex(t => t.id === topic.id);
      if (index >= 0) {
        setTopicHierarchy(prev => prev.slice(0, index + 1));
      }
    } catch (error) {
      console.error('Breadcrumb navigation failed:', error);
    }
  }, [getTopicDetails, topicHierarchy]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      clearTopics();
      resetAllErrors();
    };
  }, [clearTopics, resetAllErrors]);

  // Main render function
  const renderContent = () => (
    <StyledContainer className={className}>
      <TopicBreadcrumb
        currentTopic={currentTopic}
        topicHierarchy={topicHierarchy}
        onNavigate={handleBreadcrumbNavigation}
        maxDisplayedItems={isMobile ? 2 : 4}
      />

      <ContentArea ref={parentRef}>
        <TopicList
          onTopicClick={handleTopicSelect}
          onTopicExplore={handleTopicSelect}
          className="topic-list"
          ariaLabel="Available topics"
        />
      </ContentArea>
    </StyledContainer>
  );

  // Wrap with error boundary if enabled
  if (errorBoundary) {
    return (
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onReset={() => {
          clearTopics();
          resetAllErrors();
        }}
      >
        {renderContent()}
      </ErrorBoundary>
    );
  }

  return renderContent();
});

// Display name for debugging
TopicExplorer.displayName = 'TopicExplorer';

export default TopicExplorer;