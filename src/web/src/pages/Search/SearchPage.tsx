/**
 * SearchPage Component
 * @version 1.0.0
 * @description Main search interface implementing content discovery with real-time updates,
 * comprehensive filtering, and accessibility features. Supports the 90% relevance threshold
 * and <5s processing time requirements.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { styled } from '@emotion/styled';
import { ErrorBoundary } from 'react-error-boundary';

// Internal components
import SearchBar from '../../components/search/SearchBar';
import SearchResults from '../../components/search/SearchResults';
import SearchFilters from '../../components/search/SearchFilters';

// Hooks and utilities
import { useSearch } from '../../hooks/useSearch';
import { Content } from '../../types/content.types';

// Styled components for responsive layout
const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing[8]};
  padding: ${props => props.theme.spacing[4]};
  max-width: 1280px;
  margin: 0 auto;
  width: 100%;
  min-height: 100vh;
  position: relative;

  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    gap: ${props => props.theme.spacing[4]};
    padding: ${props => props.theme.spacing[2]};
  }
`;

const SearchContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing[4]};
  width: 100%;
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: ${props => props.theme.colors.secondary[50]};
  padding: ${props => props.theme.spacing[4]} 0;
  border-bottom: 1px solid ${props => props.theme.colors.secondary[200]};

  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    gap: ${props => props.theme.spacing[2]};
    padding: ${props => props.theme.spacing[2]} 0;
  }
`;

const MainContent = styled.div`
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: ${props => props.theme.spacing[8]};
  align-items: start;

  @media (max-width: ${props => props.theme.breakpoints.md}) {
    grid-template-columns: 1fr;
    gap: ${props => props.theme.spacing[4]};
  }
`;

// Error fallback component
const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
  <div role="alert" className="error-container">
    <h2>Something went wrong</h2>
    <pre>{error.message}</pre>
    <button onClick={resetErrorBoundary}>Try again</button>
  </div>
);

/**
 * SearchPage component implementing the main search interface
 */
const SearchPage: React.FC = () => {
  // Initialize search hook with minimum 90% relevance threshold
  const {
    searchQuery,
    isLoading,
    results,
    error,
    handleSearch,
    clearSearch,
    retry
  } = useSearch(300, 0.9);

  // Local state for search filters
  const [filters, setFilters] = useState({
    contentTypes: ['VIDEO', 'ARTICLE', 'PODCAST', 'BOOK'],
    qualityThreshold: 0.9,
    timeRange: '7d'
  });

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: any) => {
    setFilters(newFilters);
    // Trigger new search with updated filters
    handleSearch(searchQuery, newFilters);
  }, [searchQuery, handleSearch]);

  // Handle result click
  const handleResultClick = useCallback((content: Content) => {
    // Navigate to content detail page
    window.location.href = `/content/${content.id}`;
  }, []);

  // Setup keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="search"]');
        if (searchInput instanceof HTMLInputElement) {
          searchInput.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={retry}
    >
      <PageContainer>
        <SearchContainer>
          <SearchBar
            placeholder="Search topics... (Press '/' to focus)"
            fullWidth
            minLength={3}
            debounceMs={300}
            onError={(error) => console.error('Search error:', error)}
          />
        </SearchContainer>

        <MainContent>
          <SearchFilters
            onFilterChange={handleFilterChange}
            isLoading={isLoading}
            error={error?.message}
            ariaLabel="Search filters"
          />

          <SearchResults
            onResultClick={handleResultClick}
            testId="search-results"
            errorBoundary={false} // Already wrapped in ErrorBoundary
          />
        </MainContent>

        {/* Accessibility announcements */}
        <div
          role="status"
          aria-live="polite"
          className="sr-only"
        >
          {isLoading ? 'Searching...' : 
           error ? `Search error: ${error.message}` :
           results.length > 0 ? `Found ${results.length} results` :
           searchQuery ? 'No results found' : ''}
        </div>
      </PageContainer>
    </ErrorBoundary>
  );
};

export default SearchPage;