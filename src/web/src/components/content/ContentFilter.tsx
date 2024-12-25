import React, { useCallback, useState, useEffect } from 'react'; // v18.0.0
import styled from '@emotion/styled'; // v11.0.0
import { FormGroup, FormLabel } from '@mui/material'; // v5.0.0
import { debounce } from 'lodash'; // v4.17.21

import Checkbox from '../common/Checkbox';
import Select from '../common/Select';
import CustomSlider from '../common/Slider';
import { ContentType, ContentFilter as IContentFilter } from '../../types/content.types';

// Constants
const DATE_RANGE_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' }
];

const MIN_QUALITY_SCORE = 0;
const MAX_QUALITY_SCORE = 100;
const QUALITY_SCORE_STEP = 5;
const FILTER_UPDATE_DEBOUNCE = 300;

// Interfaces
export interface ContentFilterProps {
  filter: IContentFilter;
  onChange: (filter: IContentFilter) => void;
  className?: string;
  disabled?: boolean;
  error?: string;
  initialValues?: Partial<IContentFilter>;
}

// Styled Components
const StyledFilterContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[4]};
  padding: ${({ theme }) => theme.spacing[4]};
  background: ${({ theme }) => theme.colors.secondary[50]};
  border-radius: ${({ theme }) => theme.borderRadius.md};

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    flex-direction: row;
    align-items: flex-start;
  }
`;

const FilterSection = styled.div`
  flex: 1;
  min-width: 200px;
`;

const FilterLabel = styled(FormLabel)`
  margin-bottom: ${({ theme }) => theme.spacing[2]};
  color: ${({ theme }) => theme.colors.secondary[700]};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
`;

/**
 * ContentFilter Component
 * 
 * A comprehensive filter control panel for content discovery with accessibility support.
 * Implements WCAG 2.1 Level AA compliance for all interactive elements.
 */
export const ContentFilter: React.FC<ContentFilterProps> = ({
  filter,
  onChange,
  className,
  disabled = false,
  error,
  initialValues
}) => {
  // Local state for managing filter values
  const [localFilter, setLocalFilter] = useState<IContentFilter>(filter);

  // Initialize with initial values if provided
  useEffect(() => {
    if (initialValues) {
      setLocalFilter(prev => ({
        ...prev,
        ...initialValues
      }));
    }
  }, [initialValues]);

  // Debounced onChange handler to prevent excessive updates
  const debouncedOnChange = useCallback(
    debounce((newFilter: IContentFilter) => {
      onChange(newFilter);
    }, FILTER_UPDATE_DEBOUNCE),
    [onChange]
  );

  // Handle content type checkbox changes
  const handleTypeChange = useCallback((type: ContentType, checked: boolean) => {
    if (disabled) return;

    setLocalFilter(prev => {
      const newTypes = checked
        ? [...prev.types, type]
        : prev.types.filter(t => t !== type);

      const newFilter = {
        ...prev,
        types: newTypes
      };

      debouncedOnChange(newFilter);
      return newFilter;
    });
  }, [disabled, debouncedOnChange]);

  // Handle quality score slider changes
  const handleQualityChange = useCallback((value: number) => {
    if (disabled) return;

    setLocalFilter(prev => {
      const newFilter = {
        ...prev,
        minQualityScore: value / 100 // Normalize to 0-1 range
      };

      debouncedOnChange(newFilter);
      return newFilter;
    });
  }, [disabled, debouncedOnChange]);

  // Handle date range selection changes
  const handleDateRangeChange = useCallback((value: string) => {
    if (disabled) return;

    const now = new Date();
    let start: string | undefined;

    switch (value) {
      case '7d':
        start = new Date(now.setDate(now.getDate() - 7)).toISOString();
        break;
      case '30d':
        start = new Date(now.setDate(now.getDate() - 30)).toISOString();
        break;
      case '90d':
        start = new Date(now.setDate(now.getDate() - 90)).toISOString();
        break;
      default:
        start = undefined;
    }

    setLocalFilter(prev => {
      const newFilter = {
        ...prev,
        dateRange: {
          start,
          end: new Date().toISOString()
        }
      };

      debouncedOnChange(newFilter);
      return newFilter;
    });
  }, [disabled, debouncedOnChange]);

  return (
    <StyledFilterContainer className={className}>
      <FilterSection>
        <FormGroup>
          <FilterLabel id="content-types-label">Content Types</FilterLabel>
          {Object.values(ContentType).map(type => (
            <Checkbox
              key={type}
              id={`content-type-${type.toLowerCase()}`}
              name={`content-type-${type.toLowerCase()}`}
              label={type.replace('_', ' ')}
              checked={localFilter.types.includes(type)}
              onChange={(checked) => handleTypeChange(type, checked)}
              disabled={disabled}
              aria-labelledby="content-types-label"
            />
          ))}
        </FormGroup>
      </FilterSection>

      <FilterSection>
        <FilterLabel id="quality-score-label">
          Minimum Quality Score
        </FilterLabel>
        <CustomSlider
          value={localFilter.minQualityScore * 100} // Convert from 0-1 to 0-100
          onChange={(value) => handleQualityChange(value as number)}
          min={MIN_QUALITY_SCORE}
          max={MAX_QUALITY_SCORE}
          step={QUALITY_SCORE_STEP}
          disabled={disabled}
          aria-labelledby="quality-score-label"
          marks={[
            { value: 0, label: '0%' },
            { value: 50, label: '50%' },
            { value: 100, label: '100%' }
          ]}
        />
      </FilterSection>

      <FilterSection>
        <FilterLabel id="date-range-label">Date Range</FilterLabel>
        <Select
          options={DATE_RANGE_OPTIONS}
          value={localFilter.dateRange.start ? '7d' : 'all'}
          onChange={(value) => handleDateRangeChange(value as string)}
          label="Select Date Range"
          disabled={disabled}
          error={!!error}
          helperText={error}
          aria-labelledby="date-range-label"
        />
      </FilterSection>
    </StyledFilterContainer>
  );
};

export default ContentFilter;