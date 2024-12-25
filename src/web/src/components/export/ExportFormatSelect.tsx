/**
 * Export Format Select Component
 * Version: 1.0.0
 * 
 * A highly accessible, internationalized select dropdown component for choosing
 * export document formats (Markdown, PDF, or Notion) with comprehensive validation
 * and error handling capabilities.
 */

import React, { useCallback, useMemo } from 'react'; // v18.0.0
import { Select, SelectProps, SelectOption } from '../common/Select';
import { ExportFormat } from '../../types/export.types';

/**
 * Props interface for the ExportFormatSelect component
 */
export interface ExportFormatSelectProps {
  /**
   * Currently selected export format
   */
  value: ExportFormat;
  
  /**
   * Callback fired when format selection changes
   */
  onChange: (format: ExportFormat) => void;
  
  /**
   * Whether the select is disabled
   */
  disabled?: boolean;
  
  /**
   * Whether the select is in an error state
   */
  error?: boolean;
  
  /**
   * Helper text to display below the select
   */
  helperText?: string;
  
  /**
   * Accessibility label for screen readers
   */
  ariaLabel?: string;
}

/**
 * ExportFormatSelect component that provides an accessible dropdown
 * for selecting document export formats
 */
export const ExportFormatSelect = React.memo<ExportFormatSelectProps>((props) => {
  const {
    value,
    onChange,
    disabled = false,
    error = false,
    helperText,
    ariaLabel = 'Select export format'
  } = props;

  // Memoized array of export format options
  const formatOptions = useMemo<SelectOption[]>(() => [
    {
      value: ExportFormat.MARKDOWN,
      label: 'Markdown',
      description: 'Export as Markdown document with GitHub flavor',
    },
    {
      value: ExportFormat.PDF,
      label: 'PDF',
      description: 'Export as PDF document with customizable layout',
    },
    {
      value: ExportFormat.NOTION,
      label: 'Notion',
      description: 'Export directly to Notion workspace',
    }
  ], []);

  // Memoized change handler
  const handleChange = useCallback((
    newValue: string | string[] | number | number[],
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    // Ensure single string value
    if (typeof newValue === 'string' && Object.values(ExportFormat).includes(newValue as ExportFormat)) {
      onChange(newValue as ExportFormat);
    }
  }, [onChange]);

  return (
    <Select
      value={value}
      onChange={handleChange}
      options={formatOptions}
      label="Export Format"
      disabled={disabled}
      error={error}
      helperText={helperText}
      required
      fullWidth
      aria-label={ariaLabel}
      // Additional accessibility attributes
      aria-required="true"
      aria-invalid={error}
      aria-describedby={helperText ? 'export-format-helper-text' : undefined}
      // Style customization
      size="medium"
      className="export-format-select"
    />
  );
});

// Display name for debugging
ExportFormatSelect.displayName = 'ExportFormatSelect';

export default ExportFormatSelect;