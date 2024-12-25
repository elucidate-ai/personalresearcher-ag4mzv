import React, { useState, useEffect, useCallback, useMemo, memo } from 'react'; // ^18.0.0
import { styled } from '@mui/material/styles'; // ^5.0.0
import debounce from 'lodash/debounce'; // ^4.17.21

import { useSearch } from '../../hooks/useSearch';
import { StorageService, StorageError } from '../../services/storage.service';
import { Button } from '../common/Button';

// Constants
const STORAGE_KEY = 'recent_searches_v1';
const MAX_RECENT_SEARCHES = 5;
const STORAGE_DEBOUNCE_MS = 500;

// Initialize storage service with encryption
const storageService = new StorageService(
  process.env.VITE_STORAGE_ENCRYPTION_KEY || 'default-key-32-chars-required-here',
  'search'
);

// Props interface
export interface RecentSearchesProps {
  maxItems?: number;
  className?: string;
  onError?: (error: StorageError) => void;
}

// Recent search item interface
export interface RecentSearch {
  query: string;
  timestamp: number;
}

// Styled components
const StyledRecentSearches = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  marginTop: theme.spacing(2),
  role: 'navigation',
  'aria-label': 'Recent searches',
  '& .recent-search-item': {
    width: '100%',
    justifyContent: 'flex-start',
    textAlign: 'left',
    padding: theme.spacing(1, 2),
    borderRadius: theme.shape.borderRadius,
    transition: theme.transitions.create(['background-color', 'box-shadow']),
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
    '&:focus': {
      boxShadow: `0 0 0 2px ${theme.palette.primary.main}`,
    },
  },
}));

/**
 * RecentSearches Component
 * Displays and manages a list of recent search queries with persistent storage
 */
export const RecentSearches = memo(({
  maxItems = MAX_RECENT_SEARCHES,
  className,
  onError,
}: RecentSearchesProps) => {
  // State management
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  
  // Hooks
  const { handleSearch } = useSearch();

  // Load recent searches from storage
  useEffect(() => {
    const loadRecentSearches = async () => {
      try {
        const stored = await storageService.getItem<RecentSearch[]>(STORAGE_KEY);
        setRecentSearches(stored || []);
      } catch (error) {
        onError?.(error as StorageError);
      } finally {
        setLoading(false);
      }
    };

    loadRecentSearches();
  }, [onError]);

  // Debounced storage update
  const updateStorage = useMemo(
    () =>
      debounce(async (searches: RecentSearch[]) => {
        try {
          await storageService.setItem(STORAGE_KEY, searches);
        } catch (error) {
          onError?.(error as StorageError);
        }
      }, STORAGE_DEBOUNCE_MS),
    [onError]
  );

  // Handle clicking a recent search item
  const handleRecentSearchClick = useCallback(async (searchQuery: string) => {
    setLoadingStates(prev => ({ ...prev, [searchQuery]: true }));
    
    try {
      await handleSearch(searchQuery);
      
      // Move clicked search to top of list
      setRecentSearches(prev => {
        const filtered = prev.filter(item => item.query !== searchQuery);
        const newSearches = [
          { query: searchQuery, timestamp: Date.now() },
          ...filtered,
        ].slice(0, maxItems);
        
        updateStorage(newSearches);
        return newSearches;
      });
    } catch (error) {
      onError?.(error as StorageError);
    } finally {
      setLoadingStates(prev => ({ ...prev, [searchQuery]: false }));
    }
  }, [handleSearch, maxItems, updateStorage, onError]);

  // Add new search to recent searches
  const addToRecentSearches = useCallback((query: string) => {
    if (!query.trim()) return;

    setRecentSearches(prev => {
      const filtered = prev.filter(item => item.query !== query);
      const newSearches = [
        { query, timestamp: Date.now() },
        ...filtered,
      ].slice(0, maxItems);
      
      updateStorage(newSearches);
      return newSearches;
    });
  }, [maxItems, updateStorage]);

  if (loading) {
    return (
      <StyledRecentSearches className={className}>
        <div aria-busy="true" aria-label="Loading recent searches">
          Loading recent searches...
        </div>
      </StyledRecentSearches>
    );
  }

  if (!recentSearches.length) {
    return null;
  }

  return (
    <StyledRecentSearches className={className}>
      <h2 className="text-sm font-medium text-gray-500 mb-2">Recent Searches</h2>
      {recentSearches.map(({ query, timestamp }) => (
        <Button
          key={`${query}-${timestamp}`}
          variant="text"
          className="recent-search-item"
          onClick={() => handleRecentSearchClick(query)}
          loading={loadingStates[query]}
          aria-label={`Search again for ${query}`}
        >
          {query}
        </Button>
      ))}
    </StyledRecentSearches>
  );
});

RecentSearches.displayName = 'RecentSearches';

export default RecentSearches;