import React, { useState, useCallback, useRef } from 'react';
import styled from '@emotion/styled';
import { Menu, MenuItem } from '@mui/material';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import Button, { ButtonProps } from './Button';
import { theme } from '../../config/theme.config';

// Version comments for third-party dependencies
// @mui/material ^5.0.0
// @emotion/styled ^11.0.0
// @mui/icons-material ^5.0.0

/**
 * Props interface for the Dropdown component with comprehensive type safety
 */
export interface DropdownProps {
  /** Array of dropdown options with additional metadata */
  options: Array<{
    value: string;
    label: string;
    disabled?: boolean;
    description?: string;
  }>;
  /** Selected value(s) with strict type checking */
  value: string | string[];
  /** Enhanced change handler with event data */
  onChange: (value: string | string[], event: React.SyntheticEvent) => void;
  /** Placeholder text for empty state */
  placeholder?: string;
  /** Enable multi-select mode with checkboxes */
  multiple?: boolean;
  /** Disable dropdown with visual feedback */
  disabled?: boolean;
  /** Error message with aria-invalid state */
  error?: string;
  /** Additional CSS classes for customization */
  className?: string;
  /** Maximum height for dropdown menu */
  maxHeight?: number;
  /** Data test id for testing */
  testId?: string;
}

// Styled components with theme integration
const StyledButton = styled(Button)<ButtonProps & { hasError?: boolean }>`
  width: 100%;
  justify-content: space-between;
  text-align: left;
  min-height: 40px;
  padding: ${theme.spacing[2]} ${theme.spacing[4]};
  border-color: ${({ hasError }) => 
    hasError ? theme.colors.error : theme.colors.secondary[300]};
  transition: all 0.2s ease-in-out;

  &:hover {
    border-color: ${({ hasError }) =>
      hasError ? theme.colors.error : theme.colors.primary[500]};
  }

  .arrow-icon {
    transition: transform 0.2s ease;
    transform: ${({ open }) => open ? 'rotate(180deg)' : 'rotate(0)'};
  }
`;

const StyledMenu = styled(Menu)`
  .MuiPaper-root {
    max-height: ${({ maxHeight }) => maxHeight || 300}px;
    width: ${({ width }) => width}px;
    margin-top: ${theme.spacing[1]};
    box-shadow: ${theme.shadows.md};
    border-radius: ${theme.borderRadius.DEFAULT};
  }

  .MuiMenuItem-root {
    padding: ${theme.spacing[2]} ${theme.spacing[4]};
    min-height: 40px;
    
    &.Mui-disabled {
      opacity: 0.5;
    }

    &.Mui-selected {
      background-color: ${theme.colors.primary[50]};
      
      &:hover {
        background-color: ${theme.colors.primary[100]};
      }
    }
  }
`;

/**
 * A highly accessible, theme-aware dropdown component that implements Material UI v5 select menu
 * with enhanced features including single/multi-select capabilities and comprehensive error handling
 */
export const Dropdown: React.FC<DropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  multiple = false,
  disabled = false,
  error,
  className,
  maxHeight = 300,
  testId,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const open = Boolean(anchorEl);

  // Handle menu opening with positioning logic
  const handleOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    setAnchorEl(event.currentTarget);
  }, []);

  // Handle menu closing with cleanup
  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  // Handle option selection with multi-select support
  const handleSelect = useCallback((optionValue: string, event: React.SyntheticEvent) => {
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      const newValue = currentValues.includes(optionValue)
        ? currentValues.filter(v => v !== optionValue)
        : [...currentValues, optionValue];
      onChange(newValue, event);
    } else {
      onChange(optionValue, event);
      handleClose();
    }
  }, [multiple, value, onChange, handleClose]);

  // Get display value for button
  const getDisplayValue = () => {
    if (Array.isArray(value)) {
      return value.length
        ? value.map(v => options.find(opt => opt.value === v)?.label).join(', ')
        : placeholder;
    }
    return options.find(opt => opt.value === value)?.label || placeholder;
  };

  return (
    <div className={className} data-testid={testId}>
      <StyledButton
        ref={buttonRef}
        variant="outlined"
        onClick={handleOpen}
        disabled={disabled}
        hasError={Boolean(error)}
        open={open}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${testId}-error` : undefined}
        endIcon={<KeyboardArrowDown className="arrow-icon" />}
      >
        {getDisplayValue()}
      </StyledButton>

      {error && (
        <div
          id={`${testId}-error`}
          role="alert"
          style={{
            color: theme.colors.error,
            fontSize: theme.typography.fontSize.sm,
            marginTop: theme.spacing[1]
          }}
        >
          {error}
        </div>
      )}

      <StyledMenu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        maxHeight={maxHeight}
        width={buttonRef.current?.offsetWidth}
        MenuListProps={{
          'aria-labelledby': testId,
          role: 'listbox',
          'aria-multiselectable': multiple
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left'
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left'
        }}
      >
        {options.map((option) => (
          <MenuItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            selected={multiple 
              ? Array.isArray(value) && value.includes(option.value)
              : value === option.value
            }
            onClick={(e) => handleSelect(option.value, e)}
            role="option"
            aria-selected={value === option.value}
          >
            {option.label}
            {option.description && (
              <span
                style={{
                  fontSize: theme.typography.fontSize.sm,
                  color: theme.colors.secondary[500],
                  marginLeft: theme.spacing[2]
                }}
              >
                {option.description}
              </span>
            )}
          </MenuItem>
        ))}
      </StyledMenu>
    </div>
  );
};

// Display name for debugging
Dropdown.displayName = 'Dropdown';

export default Dropdown;