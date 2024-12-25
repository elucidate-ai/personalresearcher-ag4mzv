import React, { memo, useCallback, useEffect } from 'react';
import { styled } from '@mui/material/styles'; // ^5.0.0
import { Dialog as MuiDialog, DialogTitle, DialogContent, DialogActions } from '@mui/material'; // ^5.0.0
import Button from './Button';
import LoadingSpinner from './LoadingSpinner';

// Constants for dialog configuration
const DIALOG_SIZES = ['small', 'medium', 'large', 'fullscreen'] as const;
const ANIMATION_DURATION = 225;
const Z_INDEX_DIALOG = 1300;

/**
 * Props interface for the Dialog component with enhanced accessibility and interaction options
 */
export interface DialogProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Controls dialog visibility state */
  open: boolean;
  /** Handler for dialog close events with reason type */
  onClose: (event: {}, reason: 'backdropClick' | 'escapeKeyDown') => void;
  /** Dialog title content with support for string or rich content */
  title: string | React.ReactNode;
  /** Controls dialog size with responsive behavior */
  size?: typeof DIALOG_SIZES[number];
  /** Shows loading state with spinner overlay */
  loading?: boolean;
  /** Footer action buttons with loading state support */
  actions?: React.ReactNode;
  /** Prevents dialog close on backdrop click */
  disableBackdropClick?: boolean;
  /** Prevents dialog close on escape key */
  disableEscapeKeyDown?: boolean;
  /** Makes dialog take full width of container */
  fullWidth?: boolean;
  /** Dialog content with support for any valid React node */
  children: React.ReactNode;
  /** Accessibility label for screen readers */
  ariaLabel?: string;
  /** ID of element describing the dialog */
  ariaDescribedBy?: string;
}

/**
 * Styled dialog component with theme integration and responsive behavior
 */
const StyledDialog = styled(MuiDialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    margin: theme.spacing(2),
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    boxShadow: theme.shadows[8],
    backdropFilter: 'blur(4px)',
    maxHeight: '90vh',
    overflowY: 'auto',
    position: 'relative',
    
    // Responsive sizing based on breakpoints
    [theme.breakpoints.down('sm')]: {
      width: 'calc(100% - 32px)',
      margin: theme.spacing(2),
    },
  },

  '& .MuiDialogTitle-root': {
    padding: theme.spacing(2),
    paddingBottom: theme.spacing(1),
    '& .MuiTypography-root': {
      fontSize: theme.typography.h6.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
    },
  },

  '& .MuiDialogContent-root': {
    padding: theme.spacing(2),
    paddingTop: theme.spacing(1),
    position: 'relative',
  },

  '& .MuiDialogActions-root': {
    padding: theme.spacing(2),
    gap: theme.spacing(1),
  },
}));

/**
 * Get size-specific styles for the dialog
 */
const getSizeStyles = (size: DialogProps['size']) => {
  const styles: Record<typeof DIALOG_SIZES[number], object> = {
    small: {
      maxWidth: '400px',
    },
    medium: {
      maxWidth: '600px',
    },
    large: {
      maxWidth: '800px',
    },
    fullscreen: {
      maxWidth: '100vw',
      height: '100vh',
      margin: 0,
      borderRadius: 0,
    },
  };

  return styles[size || 'medium'];
};

/**
 * A highly customizable, accessible dialog component that implements Material UI v5 design system
 * Supports multiple sizes, loading states, and comprehensive accessibility features
 */
export const Dialog = memo(({
  open,
  onClose,
  title,
  size = 'medium',
  loading = false,
  actions,
  disableBackdropClick = false,
  disableEscapeKeyDown = false,
  fullWidth = false,
  children,
  ariaLabel,
  ariaDescribedBy,
  ...rest
}: DialogProps) => {
  // Handle dialog close events
  const handleClose = useCallback((event: {}, reason: 'backdropClick' | 'escapeKeyDown') => {
    if ((reason === 'backdropClick' && disableBackdropClick) || 
        (reason === 'escapeKeyDown' && disableEscapeKeyDown)) {
      return;
    }
    onClose(event, reason);
  }, [onClose, disableBackdropClick, disableEscapeKeyDown]);

  // Manage focus trap and keyboard interactions
  useEffect(() => {
    if (open) {
      // Lock body scroll when dialog is open
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [open]);

  return (
    <StyledDialog
      open={open}
      onClose={handleClose}
      aria-labelledby="dialog-title"
      aria-describedby={ariaDescribedBy}
      aria-label={ariaLabel}
      fullWidth={fullWidth}
      maxWidth={false}
      PaperProps={{
        style: {
          ...getSizeStyles(size),
        },
      }}
      TransitionProps={{
        timeout: ANIMATION_DURATION,
      }}
      sx={{
        zIndex: Z_INDEX_DIALOG,
      }}
      {...rest}
    >
      {/* Dialog Title */}
      {title && (
        <DialogTitle id="dialog-title">
          {title}
        </DialogTitle>
      )}

      {/* Dialog Content with Loading Overlay */}
      <DialogContent>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 z-10">
            <LoadingSpinner size="large" color="primary" />
          </div>
        )}
        {children}
      </DialogContent>

      {/* Dialog Actions */}
      {actions && (
        <DialogActions>
          {actions}
        </DialogActions>
      )}
    </StyledDialog>
  );
});

// Display name for debugging
Dialog.displayName = 'Dialog';

export default Dialog;