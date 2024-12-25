import React from 'react'; // ^18.0.0
import { Box } from '@mui/material'; // ^5.0.0
import styled from '@emotion/styled'; // ^11.0.0
import LoadingSpinner from '../common/LoadingSpinner';

/**
 * Props interface for the MainContent component
 */
interface MainContentProps {
  /** Child components to render in main content area */
  children: React.ReactNode;
  /** Loading state flag for content loading indication */
  loading?: boolean;
  /** Optional CSS class name for custom styling */
  className?: string;
  /** ARIA role for accessibility */
  role?: string;
}

/**
 * Styled container for the main content area with responsive layout
 */
const MainContentContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  padding: theme.spacing(3),
  overflow: 'auto',
  backgroundColor: theme.palette.background.default,
  position: 'relative',
  minHeight: '100vh',
  // Responsive padding adjustments
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
  },
  // Ensure proper scrolling behavior
  '&::-webkit-scrollbar': {
    width: '8px',
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: theme.palette.divider,
    borderRadius: '4px',
  },
}));

/**
 * Styled container for the loading overlay
 */
const LoadingContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '200px',
  width: '100%',
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  backgroundColor: 'rgba(255, 255, 255, 0.8)',
  zIndex: theme.zIndex.modal - 1,
  backdropFilter: 'blur(4px)',
  transition: 'opacity 0.2s ease-in-out',
  [theme.breakpoints.down('sm')]: {
    minHeight: '150px',
  },
}));

/**
 * MainContent component that serves as the primary content container
 * with support for loading states and accessibility features.
 *
 * @component
 * @example
 * ```tsx
 * // Basic usage
 * <MainContent>
 *   <h1>Page Content</h1>
 * </MainContent>
 *
 * // With loading state
 * <MainContent loading>
 *   <DataTable data={data} />
 * </MainContent>
 * ```
 */
const MainContent: React.FC<MainContentProps> = ({
  children,
  loading = false,
  className = '',
  role = 'main',
}) => {
  return (
    <MainContentContainer
      component="main"
      role={role}
      className={className}
      aria-busy={loading}
      // Ensure proper tab navigation
      tabIndex={-1}
    >
      {/* Render children with proper context */}
      {children}

      {/* Loading overlay with accessibility support */}
      {loading && (
        <LoadingContainer
          role="alert"
          aria-live="polite"
        >
          <LoadingSpinner
            size="large"
            color="primary"
            aria-label="Content loading"
          />
        </LoadingContainer>
      )}
    </MainContentContainer>
  );
};

// Export the component and its props interface
export default MainContent;
export type { MainContentProps };