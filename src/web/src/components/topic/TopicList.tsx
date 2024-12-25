import React, { memo, useCallback, useMemo } from 'react';
import { styled } from '@mui/material/styles'; // v5.0.0
import { Grid, CircularProgress, Typography, useMediaQuery } from '@mui/material'; // v5.0.0
import TopicCard, { TopicCardProps } from './TopicCard';
import { Topic } from '../../types/topic.types';
import { useTopic } from '../../hooks/useTopic';

// Interface for component props with enhanced accessibility
export interface TopicListProps {
  onTopicClick: (topic: Topic) => void;
  onTopicExplore: (topic: Topic) => void;
  className?: string;
  ariaLabel?: string;
}

// Styled wrapper for Grid component with responsive spacing
const StyledGrid = styled(Grid)(({ theme }) => ({
  padding: theme.spacing(2),
  width: '100%',
  minHeight: '200px',
  gap: theme.spacing(2),
  // Responsive padding adjustments
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1),
    gap: theme.spacing(1),
  },
  // Ensure proper spacing between grid items
  '& .MuiGrid-item': {
    display: 'flex',
    flexDirection: 'column',
  },
}));

// Error message container styling
const ErrorContainer = styled('div')(({ theme }) => ({
  padding: theme.spacing(2),
  textAlign: 'center',
  width: '100%',
  color: theme.palette.error.main,
}));

/**
 * A responsive grid of topic cards with loading state and error handling.
 * Implements 90% relevance threshold validation and accessibility features.
 */
export const TopicList = memo<TopicListProps>(({
  onTopicClick,
  onTopicExplore,
  className,
  ariaLabel = 'Topic list',
}) => {
  // Get topics and related states from hook
  const {
    topics,
    loading: { search: isLoading },
    error: { search: error },
    retryOperation,
  } = useTopic();

  // Responsive breakpoint detection
  const isMobile = useMediaQuery('(max-width:640px)');
  const isTablet = useMediaQuery('(min-width:641px) and (max-width:1024px)');

  // Filter topics based on 90% relevance threshold
  const validTopics = useMemo(() => 
    topics.filter(topic => topic.relevanceScore >= 90),
    [topics]
  );

  // Handle topic card click with error boundary
  const handleTopicClick = useCallback((topic: Topic) => {
    try {
      onTopicClick(topic);
    } catch (error) {
      console.error('Error handling topic click:', error);
    }
  }, [onTopicClick]);

  // Handle topic exploration with error boundary
  const handleTopicExplore = useCallback((topic: Topic) => {
    try {
      onTopicExplore(topic);
    } catch (error) {
      console.error('Error handling topic exploration:', error);
    }
  }, [onTopicExplore]);

  // Calculate grid item size based on screen size
  const getGridSize = useMemo(() => {
    if (isMobile) return 12;
    if (isTablet) return 6;
    return 4;
  }, [isMobile, isTablet]);

  // Render loading state
  if (isLoading) {
    return (
      <StyledGrid
        container
        justifyContent="center"
        alignItems="center"
        className={className}
        role="alert"
        aria-busy="true"
        aria-label="Loading topics"
      >
        <CircularProgress size={40} thickness={4} />
      </StyledGrid>
    );
  }

  // Render error state
  if (error) {
    return (
      <ErrorContainer role="alert" aria-label="Error loading topics">
        <Typography variant="body1" gutterBottom>
          {error}
        </Typography>
        <button
          onClick={() => retryOperation('search')}
          className="btn-primary"
          aria-label="Retry loading topics"
        >
          Retry
        </button>
      </ErrorContainer>
    );
  }

  // Render empty state
  if (!validTopics.length) {
    return (
      <StyledGrid
        container
        justifyContent="center"
        alignItems="center"
        className={className}
        role="status"
        aria-label="No topics found"
      >
        <Typography variant="body1" color="textSecondary">
          No topics found matching your criteria
        </Typography>
      </StyledGrid>
    );
  }

  // Render topic grid
  return (
    <StyledGrid
      container
      spacing={2}
      className={className}
      role="list"
      aria-label={ariaLabel}
    >
      {validTopics.map((topic) => (
        <Grid
          item
          xs={12}
          sm={getGridSize}
          key={topic.id}
          role="listitem"
        >
          <TopicCard
            topic={topic}
            onClick={() => handleTopicClick(topic)}
            onExplore={() => handleTopicExplore(topic)}
            ariaLabel={`Topic: ${topic.name}`}
          />
        </Grid>
      ))}
    </StyledGrid>
  );
});

// Display name for debugging
TopicList.displayName = 'TopicList';

export default TopicList;