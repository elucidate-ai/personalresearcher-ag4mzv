import React, { memo, useMemo } from 'react';
import { styled } from '@mui/material/styles'; // v5.0.0
import { Typography, Tooltip, Skeleton } from '@mui/material'; // v5.0.0
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Topic } from '../../types/topic.types';

// Interface for component props with comprehensive accessibility support
export interface TopicCardProps {
  topic: Topic;
  onClick: (topic: Topic) => void;
  onExplore: (topic: Topic) => void;
  className?: string;
  isLoading?: boolean;
  error?: Error | null;
  ariaLabel?: string;
}

// Styled wrapper for Card component with enhanced interactive features
const StyledTopicCard = styled(Card)(({ theme }) => ({
  minHeight: '200px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  padding: theme.spacing(2, 3),
  transition: 'all 0.2s ease-in-out',
  cursor: 'pointer',

  // Interactive states with proper focus management
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[4],
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },

  // Responsive design adjustments
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1.5, 2),
    minHeight: '180px',
  },
}));

// Styled content container for proper spacing
const ContentContainer = styled('div')(({ theme }) => ({
  flex: 1,
  marginBottom: theme.spacing(2),
}));

// Styled footer for action buttons
const CardFooter = styled('div')(({ theme }) => ({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: theme.spacing(1),
}));

// Format relevance score as percentage with proper localization
const formatRelevanceScore = (score: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(score);
};

/**
 * A reusable, accessible card component for displaying topic information
 * with enhanced interactive features and responsive design.
 */
export const TopicCard = memo<TopicCardProps>(({
  topic,
  onClick,
  onExplore,
  className,
  isLoading = false,
  error = null,
  ariaLabel,
}) => {
  // Memoize formatted relevance score
  const formattedScore = useMemo(() => 
    formatRelevanceScore(topic.relevanceScore),
    [topic.relevanceScore]
  );

  // Handle loading state
  if (isLoading) {
    return (
      <StyledTopicCard
        className={className}
        aria-busy="true"
        aria-label="Loading topic information"
      >
        <ContentContainer>
          <Skeleton variant="text" width="60%" height={32} />
          <Skeleton variant="text" width="100%" height={20} sx={{ mt: 1 }} />
          <Skeleton variant="text" width="90%" height={20} />
        </ContentContainer>
        <CardFooter>
          <Skeleton variant="rectangular" width={100} height={36} />
        </CardFooter>
      </StyledTopicCard>
    );
  }

  // Handle error state
  if (error) {
    return (
      <StyledTopicCard
        className={className}
        role="alert"
        aria-label="Error loading topic"
      >
        <Typography color="error" variant="body2">
          {error.message || 'Error loading topic information'}
        </Typography>
      </StyledTopicCard>
    );
  }

  return (
    <StyledTopicCard
      className={className}
      onClick={() => onClick(topic)}
      role="article"
      aria-label={ariaLabel || `Topic: ${topic.name}`}
      testId={`topic-card-${topic.id}`}
    >
      <ContentContainer>
        <Typography
          variant="h6"
          component="h3"
          gutterBottom
          sx={{ fontWeight: 600 }}
        >
          {topic.name}
        </Typography>

        <Tooltip
          title={topic.description}
          placement="top"
          arrow
          enterDelay={500}
        >
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              mb: 1,
            }}
          >
            {topic.description}
          </Typography>
        </Tooltip>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block' }}
        >
          Relevance Score: {formattedScore}
        </Typography>
      </ContentContainer>

      <CardFooter>
        <Button
          variant="outlined"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onExplore(topic);
          }}
          aria-label={`Explore ${topic.name}`}
        >
          Explore
        </Button>
      </CardFooter>
    </StyledTopicCard>
  );
});

// Display name for debugging
TopicCard.displayName = 'TopicCard';

export default TopicCard;