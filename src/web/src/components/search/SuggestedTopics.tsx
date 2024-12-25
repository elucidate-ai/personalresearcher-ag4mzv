import React, { useCallback, useMemo } from 'react';
import { Grid, Typography, Skeleton } from '@mui/material'; // v5.0.0
import { styled } from '@mui/material/styles'; // v5.0.0
import { Topic } from '../../types/topic.types';
import { useTopic } from '../../hooks/useTopic';
import Card from '../common/Card';

// Props interface with comprehensive configuration options
export interface SuggestedTopicsProps {
  maxTopics?: number;
  minRelevanceScore?: number;
  onTopicSelect?: (topic: Topic) => void;
}

// Styled components for enhanced visual presentation
const StyledGrid = styled(Grid)(({ theme }) => ({
  padding: theme.spacing(2),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1),
  },
}));

const TopicTitle = styled(Typography)(({ theme }) => ({
  fontFamily: theme.typography.fontFamily,
  fontWeight: 600,
  marginBottom: theme.spacing(1),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
}));

const TopicDescription = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: '0.875rem',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
}));

/**
 * SuggestedTopics component displays a responsive grid of topic cards
 * with relevance-based filtering and loading states.
 * 
 * @param {SuggestedTopicsProps} props - Component props
 * @returns {JSX.Element} Rendered component
 */
export const SuggestedTopics: React.FC<SuggestedTopicsProps> = React.memo(({
  maxTopics = 8,
  minRelevanceScore = 0.9, // 90% relevance threshold requirement
  onTopicSelect,
}) => {
  const { topics, loading, error } = useTopic();

  // Filter and sort topics based on relevance score
  const filteredTopics = useMemo(() => {
    return topics
      .filter(topic => topic.relevanceScore >= minRelevanceScore)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxTopics);
  }, [topics, maxTopics, minRelevanceScore]);

  // Handle topic selection with debouncing
  const handleTopicClick = useCallback((topic: Topic) => {
    if (onTopicSelect) {
      onTopicSelect(topic);
    }
  }, [onTopicSelect]);

  // Render loading skeletons
  if (loading.search) {
    return (
      <StyledGrid container spacing={2}>
        {Array.from(new Array(maxTopics)).map((_, index) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={`skeleton-${index}`}>
            <Card elevation={1} testId={`topic-skeleton-${index}`}>
              <Skeleton variant="rectangular" height={24} width="80%" />
              <Skeleton variant="rectangular" height={60} width="100%" style={{ marginTop: 8 }} />
            </Card>
          </Grid>
        ))}
      </StyledGrid>
    );
  }

  // Render error state
  if (error.search) {
    return (
      <Typography 
        color="error" 
        align="center" 
        role="alert"
        data-testid="topics-error"
      >
        {error.search}
      </Typography>
    );
  }

  // Render empty state
  if (filteredTopics.length === 0) {
    return (
      <Typography 
        color="textSecondary" 
        align="center"
        data-testid="no-topics"
      >
        No suggested topics found matching the relevance criteria.
      </Typography>
    );
  }

  // Render topic grid
  return (
    <StyledGrid 
      container 
      spacing={2}
      role="list"
      aria-label="Suggested topics"
      data-testid="topics-grid"
    >
      {filteredTopics.map((topic) => (
        <Grid 
          item 
          xs={12} 
          sm={6} 
          md={4} 
          lg={3} 
          key={topic.id}
          role="listitem"
        >
          <Card
            elevation={2}
            onClick={() => handleTopicClick(topic)}
            role="button"
            tabIndex={0}
            ariaLabel={`Select topic: ${topic.name}`}
            testId={`topic-card-${topic.id}`}
          >
            <TopicTitle variant="h6" component="h3">
              {topic.name}
            </TopicTitle>
            <TopicDescription variant="body2">
              {topic.description}
            </TopicDescription>
            <Typography 
              variant="caption" 
              color="textSecondary"
              sx={{ mt: 1, display: 'block' }}
            >
              Relevance: {Math.round(topic.relevanceScore * 100)}%
            </Typography>
          </Card>
        </Grid>
      ))}
    </StyledGrid>
  );
});

// Display name for debugging
SuggestedTopics.displayName = 'SuggestedTopics';

export default SuggestedTopics;