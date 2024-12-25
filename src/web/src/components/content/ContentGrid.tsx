/**
 * ContentGrid Component
 * A responsive grid layout for displaying content items with virtual scrolling
 * and comprehensive accessibility features.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { styled } from '@mui/material/styles'; // v5.0.0
import { Grid, CircularProgress, Typography } from '@mui/material'; // v5.0.0
import { useVirtualizer } from '@tanstack/react-virtual'; // v3.0.0
import { useIntersectionObserver } from 'react-intersection-observer'; // v8.32.0
import { Content } from '../../types/content.types';
import { ContentCard } from './ContentCard';
import { useContent } from '../../hooks/useContent';
import { UI_CONSTANTS } from '../../constants/app.constants';

// Constants for grid layout and virtualization
const GRID_ITEM_MIN_WIDTH = 300;
const GRID_ITEM_HEIGHT = 250;
const OVERSCAN_COUNT = 5;

// Styled components for enhanced layout and accessibility
const GridContainer = styled(Grid)(({ theme }) => ({
  padding: theme.spacing(2),
  minHeight: '400px',
  position: 'relative',
  width: '100%',
  '&[aria-busy="true"]': {
    opacity: 0.7,
    pointerEvents: 'none',
  },
}));

const LoadingContainer = styled('div')({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '16px',
});

const ErrorMessage = styled(Typography)(({ theme }) => ({
  color: theme.palette.error.main,
  textAlign: 'center',
  padding: theme.spacing(2),
}));

const EmptyMessage = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  textAlign: 'center',
  padding: theme.spacing(4),
}));

// Props interface with comprehensive type definitions
export interface ContentGridProps {
  /** Callback function when content item is selected */
  onContentSelect: (content: Content) => void;
  /** Optional CSS class name */
  className?: string;
  /** Custom grid spacing in pixels */
  gridSpacing?: number;
  /** Test identifier */
  testId?: string;
}

/**
 * ContentGrid component displays content items in a responsive grid layout
 * with virtual scrolling and accessibility features
 */
export const ContentGrid: React.FC<ContentGridProps> = React.memo(({
  onContentSelect,
  className,
  gridSpacing = UI_CONSTANTS.SPACING.md,
  testId = 'content-grid',
}) => {
  // Refs for virtualization and intersection observer
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get content data and state from custom hook
  const { content, loading, error } = useContent();

  // Calculate grid dimensions based on container width
  const getGridDimensions = useCallback(() => {
    if (!containerRef.current) return { columns: 1, rows: 1 };
    
    const containerWidth = containerRef.current.offsetWidth;
    const columns = Math.floor(containerWidth / (GRID_ITEM_MIN_WIDTH + gridSpacing));
    const rows = Math.ceil(content.length / columns);
    
    return { columns: Math.max(1, columns), rows };
  }, [content.length, gridSpacing]);

  // Memoized grid dimensions
  const { columns, rows } = useMemo(
    () => getGridDimensions(),
    [getGridDimensions]
  );

  // Virtual scroll configuration
  const virtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => GRID_ITEM_HEIGHT + gridSpacing,
    overscan: OVERSCAN_COUNT,
  });

  // Intersection observer for infinite loading
  const [bottomRef, bottomInView] = useIntersectionObserver({
    threshold: 0.5,
    rootMargin: '100px',
  });

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent, content: Content) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onContentSelect(content);
    }
  }, [onContentSelect]);

  // Update grid dimensions on resize
  useEffect(() => {
    const handleResize = () => virtualizer.measure();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [virtualizer]);

  // Render loading state
  if (loading && !content.length) {
    return (
      <LoadingContainer>
        <CircularProgress size={48} aria-label="Loading content" />
        <Typography variant="body2">Loading content...</Typography>
      </LoadingContainer>
    );
  }

  // Render error state
  if (error) {
    return (
      <ErrorMessage role="alert" variant="body1">
        {error.message || 'Error loading content. Please try again.'}
      </ErrorMessage>
    );
  }

  // Render empty state
  if (!content.length) {
    return (
      <EmptyMessage role="status" variant="body1">
        No content found. Try adjusting your filters.
      </EmptyMessage>
    );
  }

  return (
    <GridContainer
      ref={containerRef}
      container
      spacing={gridSpacing}
      className={className}
      role="grid"
      aria-busy={loading}
      aria-label="Content grid"
      data-testid={testId}
    >
      <div
        ref={scrollRef}
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const rowStart = virtualRow.index * columns;
          const rowContent = content.slice(rowStart, rowStart + columns);

          return (
            <Grid
              container
              spacing={gridSpacing}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
              key={virtualRow.index}
              role="row"
            >
              {rowContent.map((item, index) => (
                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={4}
                  lg={3}
                  key={item.id}
                  role="gridcell"
                >
                  <ContentCard
                    content={item}
                    onClick={() => onContentSelect(item)}
                    onKeyDown={(e) => handleKeyDown(e, item)}
                    tabIndex={0}
                    aria-label={`${item.title} - ${item.type.toLowerCase()} content`}
                  />
                </Grid>
              ))}
            </Grid>
          );
        })}
      </div>
      
      {/* Infinite scroll trigger */}
      <div ref={bottomRef} style={{ height: '1px' }} />
      
      {/* Loading more indicator */}
      {loading && content.length > 0 && (
        <LoadingContainer>
          <CircularProgress size={32} aria-label="Loading more content" />
        </LoadingContainer>
      )}
    </GridContainer>
  );
});

// Display name for debugging
ContentGrid.displayName = 'ContentGrid';

export default ContentGrid;