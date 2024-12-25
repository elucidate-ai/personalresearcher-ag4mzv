/**
 * A highly customizable, accessible tooltip component built on Material UI v5
 * Provides contextual information through floating tooltips with enhanced positioning and timing
 * @version 1.0.0
 */

import React, { memo } from 'react';
import { styled } from '@mui/material/styles';
import { Tooltip as MuiTooltip } from '@mui/material';
import { theme } from '../../config/theme.config';

// Valid tooltip placement options
const TOOLTIP_PLACEMENTS = [
  'top', 'bottom', 'left', 'right',
  'top-start', 'top-end',
  'bottom-start', 'bottom-end',
  'left-start', 'left-end',
  'right-start', 'right-end'
] as const;

// Default timing values
const DEFAULT_ENTER_DELAY = 200;
const DEFAULT_LEAVE_DELAY = 0;
const TOOLTIP_MAX_WIDTH = 320;

/**
 * Props interface for the Tooltip component
 */
export interface TooltipProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Content to be displayed in the tooltip */
  title: string | React.ReactNode;
  /** Element that triggers the tooltip display */
  children: React.ReactElement;
  /** Controls tooltip positioning relative to trigger element */
  placement?: typeof TOOLTIP_PLACEMENTS[number];
  /** Shows directional arrow indicator */
  arrow?: boolean;
  /** Delay in ms before showing tooltip */
  enterDelay?: number;
  /** Delay in ms before hiding tooltip */
  leaveDelay?: number;
  /** Disables tooltip display */
  disabled?: boolean;
  /** Additional CSS classes for custom styling */
  className?: string;
}

/**
 * Styled tooltip component with comprehensive theme integration
 */
const StyledTooltip = styled(MuiTooltip)(({ theme: muiTheme }) => ({
  '& .MuiTooltip-tooltip': {
    backgroundColor: theme.colors.secondary[800],
    color: theme.colors.secondary[50],
    fontSize: theme.typography.fontSize.sm,
    padding: theme.spacing[2],
    borderRadius: theme.borderRadius.DEFAULT,
    maxWidth: TOOLTIP_MAX_WIDTH,
    boxShadow: theme.shadows.DEFAULT,
    // Ensure tooltip is above other elements but below modals
    zIndex: 1400,
    // Improve readability
    lineHeight: 1.5,
    letterSpacing: '0.01em',
  },
  '& .MuiTooltip-arrow': {
    color: theme.colors.secondary[800],
    // Ensure arrow aligns properly with tooltip
    '&::before': {
      backgroundColor: 'currentColor',
    },
  },
  // Touch device optimizations
  '@media (hover: none)': {
    '& .MuiTooltip-tooltip': {
      padding: theme.spacing[4],
      fontSize: theme.typography.fontSize.base,
    },
  },
}));

/**
 * Renders an accessible, customizable tooltip component with enhanced positioning and timing controls
 * @param props - TooltipProps for configuring the tooltip behavior and appearance
 * @returns Rendered tooltip component with applied styling and behavior
 */
export const Tooltip = memo(({
  title,
  children,
  placement = 'bottom',
  arrow = true,
  enterDelay = DEFAULT_ENTER_DELAY,
  leaveDelay = DEFAULT_LEAVE_DELAY,
  disabled = false,
  className,
  ...rest
}: TooltipProps) => {
  // Don't render tooltip if disabled or no title provided
  if (disabled || !title) {
    return children;
  }

  return (
    <StyledTooltip
      title={title}
      placement={placement}
      arrow={arrow}
      enterDelay={enterDelay}
      leaveDelay={leaveDelay}
      className={className}
      // Accessibility enhancements
      enterTouchDelay={700} // Longer delay for touch devices to prevent accidental triggers
      leaveTouchDelay={1500} // Give users time to read on touch devices
      PopperProps={{
        modifiers: [{
          name: 'offset',
          options: {
            offset: [0, 8], // Maintain some space from trigger element
          },
        }],
      }}
      // ARIA attributes for screen readers
      aria-label={typeof title === 'string' ? title : undefined}
      {...rest}
    >
      {/* Clone element to add aria-describedby for accessibility */}
      {React.cloneElement(children, {
        'aria-describedby': disabled ? undefined : 'tooltip',
      })}
    </StyledTooltip>
  );
});

// Display name for debugging
Tooltip.displayName = 'Tooltip';

export default Tooltip;