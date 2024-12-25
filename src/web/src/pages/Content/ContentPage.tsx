/**
 * ContentPage Component
 * @version 1.0.0
 * @description Implements the content discovery engine's visual interface with quality assessment,
 * resource categorization, and accessibility features. Supports responsive design and
 * performance optimization for optimal user experience.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { styled } from '@mui/material/styles';
import { Box, Skeleton, Alert, useMediaQuery } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';

import MainLayout from '../../layouts/MainLayout';
import ContentPanel from '../../components/content/ContentPanel';
import { useContent } from '../../hooks/useContent';
import { Content, ContentFilter } from '../../types/content.types';
import { MIN_QUALITY_THRESHOLD } from '../../types/content.types';

// Constants for performance optimization
const CONTENT_UPDATE_DEBOUNCE = 300;
const LOADING_SKELETON_COUNT = 3;

// Interface for component props
interface ContentPageProps {
  initialFilters?: ContentFilter;
}

// Styled components with responsive design
const PageContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
  padding: theme.spacing(2),
  gap: theme.spacing(2),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1),
    gap: theme.spacing(1),
  },
}));

const LoadingSkeleton = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  padding: theme.spacing(2),
}));

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
 * ContentPage component that implements the content discovery interface
 * with comprehensive filtering, quality assessment, and accessibility features
 */
const ContentPage: React.FC<ContentPageProps> = React.memo(({
  initialFilters
}) => {
  // Initialize content management hook with quality threshold
  const {
    content,
    loading,
    error,
    searchContent,
    getContentById,
    clearCache
  } = useContent({
    cacheEnabled: true,
    retryOnError: true,
    performanceMetrics: true,
    initialFilters: {
      ...initialFilters,
      minQualityScore: MIN_QUALITY_THRESHOLD
    }
  });

  // Local state for selected content
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);

  // Media query for responsive design
  const isMobile = useMediaQuery((theme: any) => theme.breakpoints.down('sm'));

  // Handle content selection
  const handleContentSelect = useCallback((content: Content) => {
    setSelectedContent(content);
    getContentById(content.id);
  }, [getContentById]);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: ContentFilter) => {
    searchContent(newFilters);
  }, [searchContent]);

  // Handle quality threshold changes
  const handleQualityThresholdChange = useCallback((threshold: number) => {
    searchContent({
      minQualityScore: Math.max(threshold, MIN_QUALITY_THRESHOLD)
    });
  }, [searchContent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearCache();
    };
  }, [clearCache]);

  // Loading skeleton
  const renderLoadingSkeleton = () => (
    <LoadingSkeleton>
      {Array(LOADING_SKELETON_COUNT).fill(null).map((_, index) => (
        <Skeleton
          key={index}
          variant="rectangular"
          height={200}
          animation="wave"
        />
      ))}
    </LoadingSkeleton>
  );

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        searchContent({ forceRefresh: true });
      }}
    >
      <MainLayout>
        <PageContainer
          role="main"
          aria-label="Content Discovery"
        >
          {loading && !content.length && renderLoadingSkeleton()}

          <ContentPanel
            onContentSelect={handleContentSelect}
            onFilterChange={handleFilterChange}
            onQualityThresholdChange={handleQualityThresholdChange}
            initialFilters={initialFilters}
            error={error?.message}
            isRTL={false}
          />

          {error && !loading && (
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
              No content found matching your criteria. Try adjusting your filters.
            </Alert>
          )}
        </PageContainer>
      </MainLayout>
    </ErrorBoundary>
  );
});

// Display name for debugging
ContentPage.displayName = 'ContentPage';

export default ContentPage;