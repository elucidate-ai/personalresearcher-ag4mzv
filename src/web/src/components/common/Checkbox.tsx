import React, { useCallback, forwardRef } from 'react';
import styled from '@emotion/styled';
import { theme } from '../../config/theme.config';

// Constants for checkbox dimensions and styling
const CHECKBOX_SIZE = 16;
const CHECKBOX_BORDER_RADIUS = 4;

// Interface for component props with comprehensive type definitions
interface CheckboxProps {
  id: string;
  name: string;
  checked?: boolean;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  onChange: (checked: boolean) => void;
  onBlur?: () => void;
  className?: string;
  label?: string;
  ariaLabel?: string;
  ariaDescribedby?: string;
}

// Styled container component for checkbox and label
const StyledCheckboxContainer = styled.div<{ disabled?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${theme.spacing[2]};
  position: relative;
  opacity: ${props => props.disabled ? 0.5 : 1};
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
`;

// Styled checkbox input component with comprehensive state styling
const StyledCheckbox = styled.input<{ error?: string; checked?: boolean }>`
  appearance: none;
  width: ${CHECKBOX_SIZE}px;
  height: ${CHECKBOX_SIZE}px;
  border: 2px solid ${props => 
    props.error ? theme.colors.error : 
    props.checked ? theme.colors.primary[500] : 
    theme.colors.secondary[300]
  };
  border-radius: ${CHECKBOX_BORDER_RADIUS}px;
  background-color: ${props => 
    props.checked ? theme.colors.primary[500] : theme.colors.secondary[50]
  };
  cursor: inherit;
  transition: all 200ms ease-in-out;
  position: relative;
  
  &:focus-visible {
    outline: 2px solid ${theme.colors.primary[300]};
    outline-offset: 2px;
  }
  
  &:hover:not(:disabled) {
    border-color: ${props => 
      props.error ? theme.colors.error : theme.colors.primary[400]
    };
  }
  
  &:checked::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 5px;
    width: 4px;
    height: 8px;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }
`;

// Styled label component with state-based styling
const StyledLabel = styled.label<{ disabled?: boolean; required?: boolean }>`
  font-family: ${theme.typography.fontFamily.sans.join(', ')};
  font-size: ${theme.typography.fontSize.base};
  color: ${props => props.disabled ? theme.colors.secondary[400] : theme.colors.secondary[900]};
  cursor: inherit;
  user-select: none;
  
  ${props => props.required && `
    &::after {
      content: '*';
      color: ${theme.colors.error};
      margin-left: ${theme.spacing[1]};
    }
  `}
`;

// Styled error message component
const StyledError = styled.span`
  font-size: ${theme.typography.fontSize.sm};
  color: ${theme.colors.error};
  margin-top: ${theme.spacing[1]};
  display: block;
`;

// Main Checkbox component implementation
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({
  id,
  name,
  checked = false,
  disabled = false,
  required = false,
  error,
  onChange,
  onBlur,
  className,
  label,
  ariaLabel,
  ariaDescribedby,
  ...props
}, ref) => {
  
  // Handle checkbox change events
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (!disabled) {
      onChange(event.target.checked);
    }
  }, [disabled, onChange]);

  // Handle checkbox blur events
  const handleBlur = useCallback(() => {
    if (onBlur) {
      onBlur();
    }
  }, [onBlur]);

  // Generate unique error ID for aria-describedby
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, ariaDescribedby].filter(Boolean).join(' ');

  return (
    <div className={className}>
      <StyledCheckboxContainer disabled={disabled}>
        <StyledCheckbox
          ref={ref}
          type="checkbox"
          id={id}
          name={name}
          checked={checked}
          disabled={disabled}
          required={required}
          error={error}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-label={ariaLabel}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={describedBy || undefined}
          {...props}
        />
        {label && (
          <StyledLabel
            htmlFor={id}
            disabled={disabled}
            required={required}
          >
            {label}
          </StyledLabel>
        )}
      </StyledCheckboxContainer>
      {error && (
        <StyledError id={errorId} role="alert">
          {error}
        </StyledError>
      )}
    </div>
  );
});

// Display name for debugging purposes
Checkbox.displayName = 'Checkbox';

export default Checkbox;