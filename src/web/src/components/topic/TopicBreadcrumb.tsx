import React, { memo, useCallback } from 'react'; // ^18.0.0
import { styled } from '@mui/material/styles'; // ^5.0.0
import { Breadcrumbs, useMediaQuery } from '@mui/material'; // ^5.0.0
import { Topic } from '../../types/topic.types';
import Button from '../common/Button';

// Constants for accessibility and responsiveness
const MOBILE_BREAKPOINT = 640;
const DEFAULT_MAX_ITEMS = 4;
const MOBILE_MAX_ITEMS = 2;
const ARIA_LABEL = 'Topic navigation breadcrumb';

/**
 * Props interface for TopicBreadcrumb component
 */
interface TopicBreadcrumbProps {
  currentTopic: Topic | null;
  topicHierarchy: Topic[];
  onNavigate: (topic: Topic) => Promise<void>;
  onNavigationError?: (error: Error, topic: Topic) => void;
  className?: string;
  maxDisplayedItems?: number;
}

/**
 * Styled breadcrumb container with responsive design
 */
const StyledBreadcrumbs = styled(Breadcrumbs)(({ theme }) => ({
  padding: theme.spacing(1),
  margin: theme.spacing(2, 0),
  maxWidth: '100%',
  overflowX: 'auto',
  whiteSpace: 'nowrap',
  scrollbarWidth: 'thin',
  '&::-webkit-scrollbar': {
    height: '4px',
  },
  '&::-webkit-scrollbar-track': {
    background: theme.palette.grey[100],
  },
  '&::-webkit-scrollbar-thumb': {
    background: theme.palette.grey[300],
    borderRadius: '4px',
  },
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(0.5),
    margin: theme.spacing(1, 0),
  },
}));

/**
 * TopicBreadcrumb component for rendering accessible navigation trail
 */
export const TopicBreadcrumb = memo(({
  currentTopic,
  topicHierarchy,
  onNavigate,
  onNavigationError,
  className,
  maxDisplayedItems = DEFAULT_MAX_ITEMS,
}: TopicBreadcrumbProps) => {
  // Responsive design hook
  const isMobile = useMediaQuery(`(max-width:${MOBILE_BREAKPOINT}px)`);
  const effectiveMaxItems = isMobile ? MOBILE_MAX_ITEMS : maxDisplayedItems;

  /**
   * Handles click events on breadcrumb items with error handling
   */
  const handleTopicClick = useCallback(async (
    topic: Topic,
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();

    try {
      await onNavigate(topic);
    } catch (error) {
      console.error('Navigation error:', error);
      if (onNavigationError && error instanceof Error) {
        onNavigationError(error, topic);
      }
    }
  }, [onNavigate, onNavigationError]);

  /**
   * Truncates topic hierarchy based on display limits
   */
  const getTruncatedHierarchy = useCallback(() => {
    if (topicHierarchy.length <= effectiveMaxItems) {
      return topicHierarchy;
    }

    const start = topicHierarchy.slice(0, 1);
    const end = topicHierarchy.slice(-effectiveMaxItems + 1);
    return [...start, ...end];
  }, [topicHierarchy, effectiveMaxItems]);

  // Don't render if no current topic or hierarchy
  if (!currentTopic || topicHierarchy.length === 0) {
    return null;
  }

  const truncatedHierarchy = getTruncatedHierarchy();

  return (
    <nav aria-label={ARIA_LABEL} className={className}>
      <StyledBreadcrumbs
        maxItems={effectiveMaxItems}
        itemsAfterCollapse={2}
        itemsBeforeCollapse={1}
        separator="›"
        aria-label={ARIA_LABEL}
      >
        {truncatedHierarchy.map((topic, index) => {
          const isLast = index === truncatedHierarchy.length - 1;
          const isCurrentTopic = topic.id === currentTopic.id;

          return (
            <Button
              key={topic.id}
              variant={isCurrentTopic ? 'primary' : 'text'}
              size="small"
              onClick={(e) => handleTopicClick(topic, e)}
              disabled={isCurrentTopic}
              aria-current={isCurrentTopic ? 'page' : undefined}
              className={isLast ? 'font-semibold' : ''}
            >
              {topic.name}
            </Button>
          );
        })}
      </StyledBreadcrumbs>
    </nav>
  );
});

// Display name for debugging
TopicBreadcrumb.displayName = 'TopicBreadcrumb';

export default TopicBreadcrumb;