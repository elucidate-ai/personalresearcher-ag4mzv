/**
 * SearchResults Component
 * Displays search results in a responsive grid layout with quality indicators,
 * loading states, error handling, and accessibility features.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { styled } from '@mui/material/styles'; // v5.0.0
import { Typography } from '@mui/material'; // v5.0.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0

import ContentCard, { ContentCardProps } from '../content/ContentCard';
import LoadingSpinner from '../common/LoadingSpinner';
import { useSearch } from '../../hooks/useSearch';
import { Content } from '../../types/content.types';

// Styled components for layout and accessibility
const ResultsContainer = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  gap: theme.spacing(3),
  padding: theme.spacing(3),
  minHeight: '200px',
  width: '100%',
  '@media (max-width: 640px)': {
    gridTemplateColumns: '1fr',
    gap: theme.spacing(2),
    padding: theme.spacing(2),
  },
  '&[aria-busy="true"]': {
    opacity: 0.7,
    pointerEvents: 'none',
  },
}));

const EmptyStateContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(6),
  textAlign: 'center',
  color: theme.colors?.secondary[600],
  minHeight: '300px',
}));

const ErrorContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(4),
  textAlign: 'center',
  color: theme.colors?.error,
  backgroundColor: `${theme.colors?.error}10`,
  borderRadius: theme.borderRadius.DEFAULT,
}));

// Props interface with comprehensive type definitions
export interface SearchResultsProps {
  /** Handler for search result click events */
  onResultClick?: (content: Content) => void;
  /** Optional CSS class name for styling */
  className?: string;
  /** Data test ID for testing purposes */
  testId?: string;
  /** Enable/disable error boundary wrapper */
  errorBoundary?: boolean;
}

/**
 * Renders the empty state message when no results are found
 */
const renderEmptyState = () => (
  <EmptyStateContainer role="status" aria-live="polite">
    <Typography variant="h6" component="h2" gutterBottom>
      No results found
    </Typography>
    <Typography variant="body1" color="textSecondary">
      Try adjusting your search terms or filters to find more content
    </Typography>
  </EmptyStateContainer>
);

/**
 * Error fallback component for error boundary
 */
const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
  <ErrorContainer role="alert">
    <Typography variant="h6" component="h2" gutterBottom>
      Something went wrong
    </Typography>
    <Typography variant="body1" gutterBottom>
      {error.message}
    </Typography>
    <button
      onClick={resetErrorBoundary}
      className="btn-primary"
      style={{ marginTop: '16px' }}
    >
      Try again
    </button>
  </ErrorContainer>
);

/**
 * SearchResults component displays search results in a responsive grid
 * with comprehensive error handling and accessibility features
 */
export const SearchResults: React.FC<SearchResultsProps> = ({
  onResultClick,
  className,
  testId = 'search-results',
  errorBoundary = true,
}) => {
  const { searchQuery, isLoading, results, error } = useSearch();
  const resultsRef = useRef<HTMLDivElement>(null);

  // Handle keyboard navigation within results
  useEffect(() => {
    const handleKeyNavigation = (e: KeyboardEvent) => {
      if (!resultsRef.current) return;

      const cards = resultsRef.current.querySelectorAll('[role="article"]');
      const currentIndex = Array.from(cards).findIndex(
        card => card === document.activeElement
      );

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          if (currentIndex < cards.length - 1) {
            (cards[currentIndex + 1] as HTMLElement).focus();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (currentIndex > 0) {
            (cards[currentIndex - 1] as HTMLElement).focus();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyNavigation);
    return () => document.removeEventListener('keydown', handleKeyNavigation);
  }, []);

  // Handle result click with analytics tracking
  const handleResultClick = useCallback((content: Content) => {
    // Track click analytics
    try {
      // Analytics tracking would go here
      console.debug('Result clicked:', content.id);
    } catch (error) {
      console.error('Analytics error:', error);
    }
    onResultClick?.(content);
  }, [onResultClick]);

  // Render appropriate content based on state
  const renderContent = () => {
    if (error) {
      return (
        <ErrorContainer role="alert">
          <Typography variant="h6" component="h2" gutterBottom>
            Error loading results
          </Typography>
          <Typography variant="body1">{error.message}</Typography>
        </ErrorContainer>
      );
    }

    if (isLoading) {
      return (
        <EmptyStateContainer>
          <LoadingSpinner size="large" color="primary" />
          <Typography variant="body1" style={{ marginTop: '16px' }}>
            Searching for content...
          </Typography>
        </EmptyStateContainer>
      );
    }

    if (!results.length && searchQuery) {
      return renderEmptyState();
    }

    return results.map((content) => (
      <ContentCard
        key={content.id}
        content={content}
        onClick={handleResultClick}
        isLoading={isLoading}
        testId={`result-${content.id}`}
      />
    ));
  };

  const content = (
    <ResultsContainer
      ref={resultsRef}
      className={className}
      data-testid={testId}
      role="region"
      aria-label="Search Results"
      aria-busy={isLoading}
    >
      {renderContent()}
    </ResultsContainer>
  );

  // Wrap with error boundary if enabled
  return errorBoundary ? (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      {content}
    </ErrorBoundary>
  ) : content;
};

// Display name for debugging
SearchResults.displayName = 'SearchResults';

export default SearchResults;