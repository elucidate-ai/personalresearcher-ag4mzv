/**
 * SearchFilters Component
 * @version 1.0.0
 * @description Advanced filter controls for search functionality with enhanced accessibility,
 * validation, and state management features.
 */

import React, { useCallback, useEffect, useState } from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import { useAppDispatch, useAppSelector } from 'react-redux';

// Internal imports
import Checkbox from '../common/Checkbox';
import RadioGroup from '../common/RadioGroup';
import Select from '../common/Select';
import { useSearch } from '../../hooks/useSearch';

// Constants
const CONTENT_TYPES = [
  { value: 'video', label: 'Videos' },
  { value: 'article', label: 'Articles' },
  { value: 'podcast', label: 'Podcasts' }
];

const TIME_RANGES = [
  { value: '1d', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'all', label: 'All time' }
];

const QUALITY_THRESHOLDS = [
  { value: 0.9, label: '90% and above' },
  { value: 0.8, label: '80% and above' },
  { value: 0.7, label: '70% and above' }
];

const MIN_QUALITY_THRESHOLD = 0.9; // 90% minimum quality threshold requirement

// Styled Components
const FilterContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  background-color: ${props => props.theme.colors.secondary[50]};
  border-radius: ${props => props.theme.borderRadius.DEFAULT};
  box-shadow: ${props => props.theme.shadows.sm};

  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    padding: 1rem;
    gap: 1rem;
  }
`;

const FilterSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const FilterLabel = styled.label`
  font-size: ${props => props.theme.typography.fontSize.sm};
  font-weight: ${props => props.theme.typography.fontWeight.medium};
  color: ${props => props.theme.colors.secondary[700]};
`;

const ErrorText = styled.span`
  color: ${props => props.theme.colors.error};
  font-size: ${props => props.theme.typography.fontSize.sm};
  margin-top: 0.25rem;
`;

// Interfaces
interface SearchFiltersProps {
  onFilterChange: (filters: SearchFilterState) => void;
  className?: string;
  isLoading?: boolean;
  error?: string;
  ariaLabel: string;
}

interface SearchFilterState {
  contentTypes: string[];
  qualityThreshold: number;
  timeRange: string;
  isValid: boolean;
  validationErrors: string[];
}

const SearchFilters: React.FC<SearchFiltersProps> = ({
  onFilterChange,
  className,
  isLoading = false,
  error,
  ariaLabel
}) => {
  // State
  const [filters, setFilters] = useState<SearchFilterState>({
    contentTypes: [],
    qualityThreshold: MIN_QUALITY_THRESHOLD,
    timeRange: '7d',
    isValid: true,
    validationErrors: []
  });

  // Hooks
  const dispatch = useAppDispatch();
  const { handleSearch } = useSearch();

  // Validation
  const validateFilters = useCallback((newFilters: Partial<SearchFilterState>): string[] => {
    const errors: string[] = [];

    // Validate content types selection
    if (!newFilters.contentTypes?.length) {
      errors.push('At least one content type must be selected');
    }

    // Validate quality threshold
    if ((newFilters.qualityThreshold ?? filters.qualityThreshold) < MIN_QUALITY_THRESHOLD) {
      errors.push(`Quality threshold must be at least ${MIN_QUALITY_THRESHOLD * 100}%`);
    }

    return errors;
  }, [filters.qualityThreshold]);

  // Event Handlers
  const handleContentTypeChange = useCallback(debounce((contentType: string, checked: boolean) => {
    setFilters(prev => {
      const newContentTypes = checked
        ? [...prev.contentTypes, contentType]
        : prev.contentTypes.filter(type => type !== contentType);

      const newFilters = {
        ...prev,
        contentTypes: newContentTypes
      };

      const validationErrors = validateFilters(newFilters);
      const isValid = validationErrors.length === 0;

      const finalFilters = {
        ...newFilters,
        isValid,
        validationErrors
      };

      onFilterChange(finalFilters);
      handleSearch(finalFilters);

      return finalFilters;
    });
  }, 300), [validateFilters, onFilterChange, handleSearch]);

  const handleQualityChange = useCallback(debounce((threshold: number) => {
    setFilters(prev => {
      const newFilters = {
        ...prev,
        qualityThreshold: threshold
      };

      const validationErrors = validateFilters(newFilters);
      const isValid = validationErrors.length === 0;

      const finalFilters = {
        ...newFilters,
        isValid,
        validationErrors
      };

      onFilterChange(finalFilters);
      handleSearch(finalFilters);

      return finalFilters;
    });
  }, 300), [validateFilters, onFilterChange, handleSearch]);

  const handleTimeRangeChange = useCallback(debounce((range: string) => {
    setFilters(prev => {
      const newFilters = {
        ...prev,
        timeRange: range
      };

      const validationErrors = validateFilters(newFilters);
      const isValid = validationErrors.length === 0;

      const finalFilters = {
        ...newFilters,
        isValid,
        validationErrors
      };

      onFilterChange(finalFilters);
      handleSearch(finalFilters);

      return finalFilters;
    });
  }, 300), [validateFilters, onFilterChange, handleSearch]);

  return (
    <FilterContainer 
      className={className}
      role="region"
      aria-label={ariaLabel}
      aria-busy={isLoading}
    >
      <FilterSection>
        <FilterLabel id="content-types-label">Content Types</FilterLabel>
        {CONTENT_TYPES.map(type => (
          <Checkbox
            key={type.value}
            id={`content-type-${type.value}`}
            name="contentTypes"
            checked={filters.contentTypes.includes(type.value)}
            onChange={(checked) => handleContentTypeChange(type.value, checked)}
            label={type.label}
            disabled={isLoading}
            aria-describedby="content-types-label"
          />
        ))}
      </FilterSection>

      <FilterSection>
        <FilterLabel id="quality-label">Quality Threshold</FilterLabel>
        <Select
          options={QUALITY_THRESHOLDS}
          value={filters.qualityThreshold}
          onChange={(value) => handleQualityChange(value as number)}
          label="Quality"
          disabled={isLoading}
          error={filters.validationErrors.some(err => err.includes('quality'))}
          aria-describedby="quality-label"
        />
      </FilterSection>

      <FilterSection>
        <FilterLabel id="time-range-label">Time Range</FilterLabel>
        <RadioGroup
          options={TIME_RANGES}
          value={filters.timeRange}
          onChange={handleTimeRangeChange}
          name="timeRange"
          disabled={isLoading}
          aria-label="Select time range"
          aria-describedby="time-range-label"
        />
      </FilterSection>

      {(filters.validationErrors.length > 0 || error) && (
        <ErrorText role="alert">
          {filters.validationErrors.join('. ')}
          {error && filters.validationErrors.length > 0 && '. '}
          {error}
        </ErrorText>
      )}
    </FilterContainer>
  );
};

export default SearchFilters;