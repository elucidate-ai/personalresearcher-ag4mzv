import React, { useState, useCallback, useEffect } from 'react';
import { styled, useTheme } from '@mui/material/styles'; // ^5.0.0
import { Box, useMediaQuery } from '@mui/material'; // ^5.0.0
import Header from './Header';
import Sidebar from './Sidebar';
import MainContent from './MainContent';
import LoadingSpinner from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';

// Props interface
interface AppShellProps {
  children: React.ReactNode;
  loading?: boolean;
  className?: string;
}

// Styled components
const AppContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default,
  position: 'relative',
  overflow: 'hidden',
}));

const MainContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flex: 1,
  paddingTop: theme.spacing(8),
  position: 'relative',
  transition: 'padding 225ms cubic-bezier(0, 0, 0.2, 1) 0ms',
  [theme.breakpoints.down('sm')]: {
    paddingTop: theme.spacing(7),
  },
}));

const ContentWrapper = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  transition: theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
}));

/**
 * AppShell component providing the main application layout structure
 * with responsive behavior and accessibility features
 */
const AppShell: React.FC<AppShellProps> = ({
  children,
  loading = false,
  className,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { isAuthenticated, loading: authLoading } = useAuth();
  
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  // Handle sidebar toggle with animation and accessibility
  const handleSidebarToggle = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  // Handle sidebar close for mobile
  const handleSidebarClose = useCallback(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  // Handle search with loading state
  const handleSearch = useCallback(async (query: string) => {
    try {
      // Search implementation would go here
      console.log('Searching for:', query);
    } catch (error) {
      console.error('Search error:', error);
    }
  }, []);

  // Update sidebar state on viewport changes
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && sidebarOpen && isMobile) {
        handleSidebarClose();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [sidebarOpen, isMobile, handleSidebarClose]);

  return (
    <AppContainer className={className}>
      {/* Header with search and menu controls */}
      <Header
        onMenuClick={handleSidebarToggle}
        onSearch={handleSearch}
      />

      <MainContainer>
        {/* Navigation sidebar with responsive behavior */}
        <Sidebar
          open={sidebarOpen}
          onClose={handleSidebarClose}
          isAuthenticated={isAuthenticated}
        />

        {/* Main content area with loading states */}
        <ContentWrapper
          sx={{
            marginLeft: {
              sm: sidebarOpen ? '280px' : 0,
            },
            width: {
              sm: sidebarOpen ? 'calc(100% - 280px)' : '100%',
            },
          }}
        >
          <MainContent loading={loading || authLoading}>
            {children}
          </MainContent>
        </ContentWrapper>
      </MainContainer>

      {/* Accessibility announcements */}
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {loading && 'Content is loading...'}
      </div>
    </AppContainer>
  );
};

// Export with display name for debugging
AppShell.displayName = 'AppShell';

export default AppShell;