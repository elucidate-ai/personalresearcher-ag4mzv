/**
 * ContentPanel Component
 * A comprehensive panel for displaying and managing content items with enhanced accessibility
 * and performance optimizations.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from '@emotion/styled';
import { CircularProgress, Alert, Skeleton } from '@mui/material'; // v5.0.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0

import { ContentList } from './ContentList';
import { ContentFilter } from './ContentFilter';
import { useContent } from '../../hooks/useContent';
import { Content, ContentFilter as IContentFilter } from '../../types/content.types';

// Constants for performance optimization
const CONTENT_UPDATE_DEBOUNCE = 300;
const SKELETON_COUNT = 3;

// Styled components with responsive design and RTL support
const PanelContainer = styled.div<{ isRTL?: boolean }>`
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: ${({ theme }) => theme.spacing[4]};
  padding: ${({ theme }) => theme.spacing[4]};
  height: 100%;
  direction: ${props => props.isRTL ? 'rtl' : 'ltr'};

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: 250px 1fr;
    gap: ${({ theme }) => theme.spacing[2]};
    padding: ${({ theme }) => theme.spacing[2]};
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.spacing[2]};
  }
`;

const FilterSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[4]};
`;

const ContentSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
  min-height: 200px;
  position: relative;
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.8);
  z-index: 1;
`;

// Props interface with comprehensive type definitions
export interface ContentPanelProps {
  className?: string;
  onContentSelect: (content: Content) => void;
  onContentPreview?: (content: Content) => void;
  initialFilters?: IContentFilter;
  isRTL?: boolean;
}

/**
 * Error Fallback component for error boundary
 */
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <Alert
    severity="error"
    action={
      <button onClick={resetErrorBoundary}>
        Retry
      </button>
    }
  >
    {error.message}
  </Alert>
);

/**
 * ContentPanel component provides a comprehensive interface for content discovery
 * and management with enhanced accessibility features.
 */
export const ContentPanel = React.memo<ContentPanelProps>(({
  className,
  onContentSelect,
  onContentPreview,
  initialFilters,
  isRTL = false
}) => {
  // Initialize content management hook with performance tracking
  const {
    content,
    loading,
    error,
    filters,
    searchContent,
    resetFilters
  } = useContent(initialFilters);

  // Local state for filter changes
  const [localFilters, setLocalFilters] = useState<IContentFilter>(filters);

  // Handle filter changes with debouncing
  const handleFilterChange = useCallback((newFilters: IContentFilter) => {
    setLocalFilters(newFilters);
    searchContent({ ...newFilters, forceRefresh: true });
  }, [searchContent]);

  // Handle content selection with keyboard support
  const handleContentSelect = useCallback((selectedContent: Content) => {
    onContentSelect(selectedContent);
  }, [onContentSelect]);

  // Handle content preview
  const handleContentPreview = useCallback((previewContent: Content) => {
    onContentPreview?.(previewContent);
  }, [onContentPreview]);

  // Reset filters when component unmounts
  useEffect(() => {
    return () => {
      resetFilters();
    };
  }, [resetFilters]);

  // Memoized loading skeleton
  const loadingSkeleton = useMemo(() => (
    Array(SKELETON_COUNT).fill(null).map((_, index) => (
      <Skeleton
        key={index}
        variant="rectangular"
        height={200}
        animation="wave"
        sx={{ marginBottom: 2 }}
      />
    ))
  ), []);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        resetFilters();
        searchContent({ forceRefresh: true });
      }}
    >
      <PanelContainer className={className} isRTL={isRTL}>
        <FilterSection>
          <ContentFilter
            filter={localFilters}
            onChange={handleFilterChange}
            disabled={loading}
            error={error?.message}
          />
        </FilterSection>

        <ContentSection>
          {loading && !content.length && loadingSkeleton}
          
          {loading && content.length > 0 && (
            <LoadingOverlay>
              <CircularProgress size={48} aria-label="Loading content" />
            </LoadingOverlay>
          )}

          {error && (
            <Alert 
              severity="error"
              action={
                <button onClick={() => searchContent({ forceRefresh: true })}>
                  Retry
                </button>
              }
            >
              {error.message}
            </Alert>
          )}

          {!loading && !error && content.length === 0 && (
            <Alert severity="info">
              No content found matching your criteria
            </Alert>
          )}

          {content.length > 0 && (
            <ContentList
              onContentSelect={handleContentSelect}
              onContentPreview={handleContentPreview}
              virtualizeOptions={{
                overscan: 5,
                estimatedSize: 200
              }}
              errorBoundary={{
                fallback: <Alert severity="error">Error loading content</Alert>,
                onError: (error) => console.error('Content list error:', error)
              }}
            />
          )}
        </ContentSection>
      </PanelContainer>
    </ErrorBoundary>
  );
});

// Display name for debugging
ContentPanel.displayName = 'ContentPanel';

export default ContentPanel;