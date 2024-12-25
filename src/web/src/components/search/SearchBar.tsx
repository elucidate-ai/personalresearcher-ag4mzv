/**
 * SearchBar Component
 * @version 1.0.0
 * @description A robust search bar component that provides real-time topic search functionality 
 * with debounced input handling, loading state indication, error feedback, and comprehensive 
 * accessibility features.
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { SearchRounded as SearchIcon, Clear as ClearIcon, Error as ErrorIcon } from '@mui/icons-material';
import debounce from 'lodash/debounce';
import { Input } from '../common/Input';
import LoadingSpinner from '../common/LoadingSpinner';
import { useSearch } from '../../hooks/useSearch';

// Constants
const DEFAULT_DEBOUNCE_MS = 300;
const MIN_SEARCH_LENGTH = 3;

export interface SearchBarProps {
  /** Placeholder text for the search input */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether the search bar should take full width */
  fullWidth?: boolean;
  /** Minimum length required for search query */
  minLength?: number;
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Error callback handler */
  onError?: (error: Error) => void;
}

/**
 * Enhanced search bar component with comprehensive features
 */
export const SearchBar = React.memo<SearchBarProps>(({
  placeholder = 'Search topics...',
  className = '',
  fullWidth = true,
  minLength = MIN_SEARCH_LENGTH,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  onError
}) => {
  // Local state for input validation
  const [isValid, setIsValid] = useState(true);
  const [validationMessage, setValidationMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize search hook with error handling
  const {
    searchQuery,
    isLoading,
    error,
    handleSearch,
    clearSearch
  } = useSearch(debounceMs);

  // Debounced search handler
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      if (query.length >= minLength) {
        handleSearch(query);
      }
    }, debounceMs),
    [handleSearch, minLength, debounceMs]
  );

  // Input change handler with validation
  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.trim();
    
    // Validate input length
    if (value && value.length < minLength) {
      setIsValid(false);
      setValidationMessage(`Please enter at least ${minLength} characters`);
    } else {
      setIsValid(true);
      setValidationMessage('');
      debouncedSearch(value);
    }
  }, [minLength, debouncedSearch]);

  // Clear search handler
  const handleClear = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
    setIsValid(true);
    setValidationMessage('');
    clearSearch();
  }, [clearSearch]);

  // Error effect handler
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  return (
    <div 
      className={`relative flex items-center ${className}`}
      role="search"
      aria-label="Search topics"
    >
      <Input
        ref={inputRef}
        type="search"
        placeholder={placeholder}
        onChange={handleInputChange}
        error={!isValid || !!error}
        helperText={validationMessage || error?.message}
        fullWidth={fullWidth}
        required
        startAdornment={
          <SearchIcon 
            className="text-gray-400 mr-2"
            aria-hidden="true"
          />
        }
        endAdornment={
          <div className="flex items-center">
            {isLoading && (
              <LoadingSpinner 
                size="small"
                color="secondary"
                className="mr-2"
              />
            )}
            {(searchQuery || !isValid || error) && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 hover:bg-gray-100 rounded-full"
                aria-label="Clear search"
              >
                <ClearIcon className="text-gray-400" />
              </button>
            )}
            {error && (
              <ErrorIcon 
                className="text-error ml-2" 
                aria-hidden="true"
              />
            )}
          </div>
        }
        aria-invalid={!isValid || !!error}
        aria-describedby={
          !isValid || error ? 'search-error' : undefined
        }
        className="search-bar"
      />
      {(!isValid || error) && (
        <div 
          id="search-error"
          className="absolute top-full left-0 mt-1 text-sm text-error"
          role="alert"
        >
          {validationMessage || error?.message}
        </div>
      )}
    </div>
  );
});

SearchBar.displayName = 'SearchBar';

export default SearchBar;