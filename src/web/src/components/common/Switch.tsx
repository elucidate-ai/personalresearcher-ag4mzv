import React, { useCallback, useState, useRef } from 'react';
import { styled } from '@mui/material/styles';
import { Switch as MuiSwitch } from '@mui/material';
import { theme } from '../../config/theme.config';

// Define size and color constants
const SWITCH_SIZES = ['small', 'medium'] as const;
const SWITCH_COLORS = ['primary', 'secondary', 'success', 'error'] as const;
const TRANSITION_DURATION = 200; // Matches UI_CONSTANTS.ANIMATION_DURATION.fast

// Props interface with comprehensive type safety
export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'onChange'> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: typeof SWITCH_SIZES[number];
  label?: string;
  disabled?: boolean;
  color?: typeof SWITCH_COLORS[number];
}

// Styled switch component with theme integration
const StyledSwitch = styled(MuiSwitch, {
  shouldForwardProp: (prop) => prop !== 'color',
})(({ theme: muiTheme, size = 'medium', color = 'primary' }) => ({
  width: size === 'small' ? 40 : 48,
  height: size === 'small' ? 24 : 28,
  padding: theme.spacing[1],
  
  '& .MuiSwitch-switchBase': {
    padding: theme.spacing[1],
    '&.Mui-checked': {
      transform: 'translateX(16px)',
      color: '#fff',
      '& + .MuiSwitch-track': {
        backgroundColor: theme.colors[color]?.[500] || theme.colors.primary[500],
        opacity: 1,
      },
      '&.Mui-disabled + .MuiSwitch-track': {
        opacity: 0.5,
      },
    },
    '&.Mui-focusVisible .MuiSwitch-thumb': {
      border: '6px solid #fff',
      boxShadow: `0 0 0 4px ${theme.colors[color]?.[200] || theme.colors.primary[200]}`,
    },
    '&.Mui-disabled': {
      '& .MuiSwitch-thumb': {
        backgroundColor: theme.colors.secondary[100],
      },
      '& + .MuiSwitch-track': {
        opacity: 0.3,
      },
    },
  },
  
  '& .MuiSwitch-thumb': {
    boxSizing: 'border-box',
    width: size === 'small' ? 16 : 20,
    height: size === 'small' ? 16 : 20,
    transition: `transform ${TRANSITION_DURATION}ms`,
  },
  
  '& .MuiSwitch-track': {
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.secondary[400],
    opacity: 1,
    transition: `background-color ${TRANSITION_DURATION}ms`,
  },
}));

/**
 * A highly accessible switch component that follows WCAG 2.1 AA guidelines
 * with comprehensive keyboard navigation and ARIA support.
 */
export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ checked, onChange, size = 'medium', label, disabled = false, color = 'primary', ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const switchRef = useRef<HTMLInputElement>(null);
    
    // Handle keyboard interactions
    const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        onChange(!checked);
      }
    }, [checked, onChange]);
    
    // Handle focus states for accessibility
    const handleFocus = useCallback(() => {
      setIsFocused(true);
    }, []);
    
    const handleBlur = useCallback(() => {
      setIsFocused(false);
    }, []);
    
    // Handle change events
    const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.checked);
    }, [onChange]);

    return (
      <div
        role="switch"
        aria-checked={checked}
        aria-label={label}
        style={{ display: 'inline-flex', alignItems: 'center' }}
      >
        <StyledSwitch
          {...props}
          size={size}
          color={color}
          checked={checked}
          disabled={disabled}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          inputRef={ref || switchRef}
          inputProps={{
            'aria-label': label,
            'aria-checked': checked,
            role: 'switch',
            tabIndex: disabled ? -1 : 0,
          }}
        />
        {label && (
          <label
            htmlFor={props.id}
            style={{
              marginLeft: theme.spacing[2],
              color: disabled ? theme.colors.secondary[400] : 'inherit',
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {label}
          </label>
        )}
      </div>
    );
  }
);

// Display name for dev tools
Switch.displayName = 'Switch';

export default Switch;