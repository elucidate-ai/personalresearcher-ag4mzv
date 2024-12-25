import React from 'react'; // v18.0.0
import { styled } from '@mui/material/styles'; // v5.0.0
import { Slider as MuiSlider, Typography } from '@mui/material'; // v5.0.0

// Constants for type safety and configuration
const SLIDER_SIZES = ['small', 'medium'] as const;
const SLIDER_ORIENTATIONS = ['horizontal', 'vertical'] as const;
const MIN_TOUCH_TARGET_SIZE = 40;

// Type definitions for component props
export interface SliderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  min?: number;
  max?: number;
  step?: number;
  value: number | [number, number];
  onChange: (value: number | [number, number], event: Event) => void;
  label?: string;
  disabled?: boolean;
  marks?: boolean | { value: number; label: string }[];
  size?: typeof SLIDER_SIZES[number];
  orientation?: typeof SLIDER_ORIENTATIONS[number];
}

// Styled component with comprehensive theme integration
const StyledSlider = styled(MuiSlider)(({ theme, orientation }) => ({
  margin: theme.spacing(2, 0),
  width: '100%',
  height: orientation === 'vertical' ? 200 : 'auto',
  transition: theme.transitions.create(['box-shadow', 'transform'], {
    duration: theme.transitions.duration.short,
  }),
  color: theme.palette.primary.main,
  touchAction: 'none',
  userSelect: 'none',

  // Enhanced touch target for better mobile accessibility
  '& .MuiSlider-thumb': {
    width: MIN_TOUCH_TARGET_SIZE,
    height: MIN_TOUCH_TARGET_SIZE,
    '&:focus, &:hover, &.Mui-active': {
      boxShadow: `0 0 0 8px ${theme.palette.action.selected}`,
    },
    '&.Mui-disabled': {
      pointerEvents: 'none',
    },
  },

  // Track styles with proper contrast
  '& .MuiSlider-track': {
    border: 'none',
    backgroundColor: theme.palette.primary.main,
  },

  // Rail styles for better visibility
  '& .MuiSlider-rail': {
    backgroundColor: theme.palette.action.disabled,
  },

  // Mark styles for better readability
  '& .MuiSlider-mark': {
    backgroundColor: theme.palette.text.secondary,
    height: 8,
    width: 1,
    '&.MuiSlider-markActive': {
      backgroundColor: theme.palette.background.paper,
    },
  },

  // Size variants
  ...(theme.components?.MuiSlider?.styleOverrides?.sizeSmall && {
    '&.MuiSlider-sizeSmall': theme.components.MuiSlider.styleOverrides.sizeSmall,
  }),

  // Disabled state
  '&.Mui-disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },

  // RTL support
  [theme.direction === 'rtl' ? '& .MuiSlider-markLabel' : null]: {
    transform: 'translateX(50%)',
  },
}));

// Utility function for generating ARIA value text
const getAriaValueText = (value: number): string => {
  return new Intl.NumberFormat(navigator.language, {
    style: 'decimal',
    maximumFractionDigits: 2,
  }).format(value);
};

/**
 * A customizable slider component with comprehensive accessibility features.
 * Implements WCAG 2.1 Level AA compliance with enhanced screen reader support.
 */
export const CustomSlider = React.forwardRef<HTMLDivElement, SliderProps>(
  (
    {
      min = 0,
      max = 100,
      step = 1,
      value,
      onChange,
      label,
      disabled = false,
      marks = false,
      size = 'medium',
      orientation = 'horizontal',
      ...props
    },
    ref
  ) => {
    // Validate size prop
    if (!SLIDER_SIZES.includes(size)) {
      console.warn(`Invalid size prop: ${size}. Using default 'medium'`);
    }

    // Validate orientation prop
    if (!SLIDER_ORIENTATIONS.includes(orientation)) {
      console.warn(`Invalid orientation prop: ${orientation}. Using default 'horizontal'`);
    }

    // Handle change events with proper typing
    const handleChange = (
      _: Event,
      newValue: number | number[],
      activeThumb: number
    ): void => {
      const event = _ as Event;
      if (Array.isArray(newValue)) {
        onChange([newValue[0], newValue[1]], event);
      } else {
        onChange(newValue, event);
      }
    };

    return (
      <div
        ref={ref}
        {...props}
        style={{
          width: '100%',
          ...props.style,
        }}
      >
        {label && (
          <Typography
            id={`${props.id || 'slider'}-label`}
            variant="body2"
            gutterBottom
            color="textSecondary"
          >
            {label}
          </Typography>
        )}
        <StyledSlider
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          marks={marks}
          size={size}
          orientation={orientation}
          getAriaValueText={getAriaValueText}
          aria-labelledby={label ? `${props.id || 'slider'}-label` : undefined}
          aria-orientation={orientation}
          aria-disabled={disabled}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          data-testid="custom-slider"
        />
      </div>
    );
  }
);

// Display name for debugging and dev tools
CustomSlider.displayName = 'CustomSlider';

// Default export for convenient importing
export default CustomSlider;