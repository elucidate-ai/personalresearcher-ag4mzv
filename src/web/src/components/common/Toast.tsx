import React, { useEffect } from 'react'; // ^18.0.0
import { Snackbar, Alert } from '@mui/material'; // ^5.0.0
import { styled } from '@mui/material/styles'; // ^5.0.0
import LoadingSpinner from './LoadingSpinner';

/**
 * Props interface for the Toast component
 */
interface ToastProps {
  /** Type of toast notification */
  type: 'success' | 'error' | 'warning' | 'info';
  /** Content message to display */
  message: string;
  /** Controls visibility */
  open: boolean;
  /** Callback when toast is closed */
  onClose: () => void;
  /** Duration in milliseconds (null for persistent) */
  duration?: number;
  /** Shows loading spinner if true */
  loading?: boolean;
}

/**
 * Styled Alert component with theme integration
 */
const StyledAlert = styled(Alert)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[2],
  minWidth: '200px',
  maxWidth: '400px',
  fontFamily: theme.typography.fontFamily,
  fontSize: theme.typography.body2.fontSize,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  '& .MuiAlert-icon': {
    marginRight: theme.spacing(1),
    fontSize: '20px',
  },
  '& .MuiAlert-message': {
    padding: theme.spacing(1, 0),
  },
  '& .MuiAlert-action': {
    padding: theme.spacing(0, 1),
    marginRight: -theme.spacing(0.5),
  },
  transition: theme.transitions.create(['opacity', 'transform'], {
    duration: theme.transitions.duration.short,
  }),
}));

/**
 * Toast notification component that displays temporary messages with different severity levels.
 * Supports loading states, animations, and accessibility features.
 *
 * @component
 * @example
 * ```tsx
 * // Success toast
 * <Toast
 *   type="success"
 *   message="Operation completed successfully"
 *   open={true}
 *   onClose={() => setOpen(false)}
 * />
 * 
 * // Loading toast
 * <Toast
 *   type="info"
 *   message="Processing request..."
 *   open={true}
 *   onClose={() => {}}
 *   duration={null}
 *   loading={true}
 * />
 * ```
 */
const Toast: React.FC<ToastProps> = ({
  type,
  message,
  open,
  onClose,
  duration = 3000,
  loading = false,
}) => {
  // Handle auto-close timer
  useEffect(() => {
    if (open && duration && !loading) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [open, duration, loading, onClose]);

  // Prevent auto-close during loading
  const handleClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway' || loading) return;
    onClose();
  };

  return (
    <Snackbar
      open={open}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      TransitionProps={{
        enter: true,
        exit: true,
      }}
      sx={{
        '& .MuiSnackbar-root': {
          top: { xs: 8, sm: 24 },
          right: { xs: 8, sm: 24 },
        },
      }}
    >
      <StyledAlert
        severity={type}
        onClose={loading ? undefined : handleClose}
        icon={loading ? false : undefined}
        role="alert"
        aria-live={type === 'error' ? 'assertive' : 'polite'}
      >
        <div className="flex items-center gap-2">
          {loading && (
            <LoadingSpinner
              size="small"
              color={type === 'error' ? 'secondary' : 'primary'}
            />
          )}
          <span className="text-balance">{message}</span>
        </div>
      </StyledAlert>
    </Snackbar>
  );
};

// Export the component and its types
export default Toast;
export type { ToastProps };