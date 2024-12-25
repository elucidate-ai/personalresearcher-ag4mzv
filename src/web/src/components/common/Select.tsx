/**
 * Enhanced Select Component
 * Version: 1.0.0
 * 
 * A comprehensive select dropdown component implementing Material UI v5 with
 * enhanced accessibility, validation, and responsive design capabilities.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'; // v18.0.0
import { styled } from '@mui/material/styles'; // v5.0.0
import { Select as MuiSelect, MenuItem, FormControl, InputLabel } from '@mui/material'; // v5.0.0
import { validateContentType } from '../../utils/validation.utils';

// Constants
const SELECT_SIZES = ['small', 'medium', 'large'] as const;
const DEFAULT_MAX_SELECTIONS = 10;

// Interfaces
export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size' | 'value' | 'onChange'> {
  options: SelectOption[];
  value: string | string[] | number | number[];
  onChange: (value: string | string[] | number | number[], event: React.ChangeEvent<HTMLSelectElement>) => void;
  label: string;
  multiple?: boolean;
  size?: typeof SELECT_SIZES[number];
  error?: boolean;
  helperText?: string;
  fullWidth?: boolean;
  required?: boolean;
  disabled?: boolean;
  loading?: boolean;
  maxSelections?: number;
  customRenderOption?: (option: SelectOption) => React.ReactNode;
  onBlur?: (event: React.FocusEvent<HTMLSelectElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLSelectElement>) => void;
  className?: string;
  style?: React.CSSProperties;
}

// Styled Components
const StyledSelect = styled(MuiSelect)(({ theme, fullWidth }) => ({
  margin: theme.spacing(1, 0),
  width: fullWidth ? '100%' : 'auto',
  fontFamily: theme.typography.fontFamily,
  transition: theme.transitions.create(['border-color', 'box-shadow']),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.paper,
  '&:hover': {
    borderColor: theme.palette.primary.main,
  },
  '&:focus': {
    boxShadow: theme.shadows[2],
  },
  '&.error': {
    borderColor: theme.palette.error.main,
  },
  '&.disabled': {
    opacity: theme.palette.action.disabledOpacity,
  },
}));

const StyledMenuItem = styled(MenuItem)(({ theme }) => ({
  padding: theme.spacing(1, 2),
  minHeight: theme.spacing(5),
  fontFamily: theme.typography.fontFamily,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  '&.selected': {
    backgroundColor: theme.palette.action.selected,
  },
  '&.disabled': {
    opacity: theme.palette.action.disabledOpacity,
  },
}));

/**
 * Enhanced Select component with comprehensive features and accessibility support
 */
export const Select = React.memo(React.forwardRef<HTMLSelectElement, SelectProps>((props, ref) => {
  const {
    options,
    value,
    onChange,
    label,
    multiple = false,
    size = 'medium',
    error = false,
    helperText,
    fullWidth = false,
    required = false,
    disabled = false,
    loading = false,
    maxSelections = DEFAULT_MAX_SELECTIONS,
    customRenderOption,
    onBlur,
    onFocus,
    className,
    style,
    ...rest
  } = props;

  // Refs and State
  const selectRef = useRef<HTMLSelectElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Memoized Values
  const selectedValues = useMemo(() => 
    Array.isArray(value) ? value : [value]
  , [value]);

  const isMaxSelected = useMemo(() => 
    multiple && selectedValues.length >= maxSelections
  , [multiple, selectedValues.length, maxSelections]);

  // Validation
  useEffect(() => {
    if (selectedValues.length > 0) {
      const errors: string[] = [];
      selectedValues.forEach(val => {
        const { isValid, errors: validationErrors } = validateContentType(String(val));
        if (!isValid) {
          errors.push(...validationErrors);
        }
      });
      setValidationErrors(errors);
    }
  }, [selectedValues]);

  // Event Handlers
  const handleChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    if (disabled || loading) return;

    const newValue = multiple
      ? Array.from(event.target.selectedOptions, option => option.value)
      : event.target.value;

    if (multiple && Array.isArray(newValue) && newValue.length > maxSelections) {
      return;
    }

    onChange(newValue, event);
  }, [disabled, loading, multiple, maxSelections, onChange]);

  const handleFocus = useCallback((event: React.FocusEvent<HTMLSelectElement>) => {
    setIsFocused(true);
    onFocus?.(event);
  }, [onFocus]);

  const handleBlur = useCallback((event: React.FocusEvent<HTMLSelectElement>) => {
    setIsFocused(false);
    onBlur?.(event);
  }, [onBlur]);

  // Render Option
  const renderOption = useCallback((option: SelectOption) => {
    if (customRenderOption) {
      return customRenderOption(option);
    }

    return (
      <StyledMenuItem
        key={option.value}
        value={option.value}
        disabled={option.disabled || (isMaxSelected && !selectedValues.includes(option.value))}
        className={`
          ${option.disabled ? 'disabled' : ''}
          ${selectedValues.includes(option.value) ? 'selected' : ''}
        `}
      >
        {option.icon && <span className="option-icon">{option.icon}</span>}
        <span className="option-label">{option.label}</span>
        {option.description && (
          <span className="option-description" title={option.description}>
            {option.description}
          </span>
        )}
      </StyledMenuItem>
    );
  }, [customRenderOption, isMaxSelected, selectedValues]);

  return (
    <FormControl
      fullWidth={fullWidth}
      error={error || validationErrors.length > 0}
      disabled={disabled}
      required={required}
      className={className}
      style={style}
    >
      <InputLabel
        id={`${label}-label`}
        shrink={isFocused || selectedValues.length > 0}
        error={error || validationErrors.length > 0}
        required={required}
      >
        {label}
      </InputLabel>

      <StyledSelect
        ref={ref}
        labelId={`${label}-label`}
        multiple={multiple}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        size={size}
        fullWidth={fullWidth}
        disabled={disabled || loading}
        error={error || validationErrors.length > 0}
        className={`
          ${error || validationErrors.length > 0 ? 'error' : ''}
          ${disabled ? 'disabled' : ''}
        `}
        {...rest}
        aria-label={label}
        aria-required={required}
        aria-invalid={error || validationErrors.length > 0}
        aria-describedby={helperText ? `${label}-helper-text` : undefined}
      >
        {options.map(renderOption)}
      </StyledSelect>

      {(helperText || validationErrors.length > 0) && (
        <div
          id={`${label}-helper-text`}
          className="helper-text"
          role="alert"
          aria-live="polite"
        >
          {validationErrors.length > 0
            ? validationErrors.join('. ')
            : helperText}
        </div>
      )}
    </FormControl>
  );
}));

Select.displayName = 'Select';

export default Select;