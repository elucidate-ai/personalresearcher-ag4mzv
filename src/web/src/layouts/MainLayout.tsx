import React, { useState, useCallback, useEffect } from 'react';
import { styled, useTheme } from '@mui/material/styles'; // ^5.0.0
import { Box, useMediaQuery } from '@mui/material'; // ^5.0.0

import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import MainContent from '../components/layout/MainContent';
import { useAuth } from '../hooks/useAuth';

// Props interface for MainLayout component
interface MainLayoutProps {
  children: React.ReactNode;
  loading?: boolean;
  className?: string;
}

// Styled components for layout structure
const LayoutContainer = styled(Box)(({ theme }) => ({
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
  overflow: 'hidden',
  position: 'relative',
  transition: theme.transitions.create(['padding-left'], {
    easing: theme.transitions.easing.sharp,
    duration: 225,
  }),
}));

const ContentWrapper = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  marginTop: 64, // Header height
  [theme.breakpoints.down('sm')]: {
    marginTop: 56, // Smaller header height on mobile
  },
}));

/**
 * MainLayout component that implements the application shell structure
 * with responsive header, sidebar navigation, and main content area.
 * Implements WCAG 2.1 AA compliance and proper theme integration.
 */
const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  loading = false,
  className,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { isAuthenticated, user } = useAuth();

  // State for sidebar visibility
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  // Handle sidebar toggle with animation handling
  const handleSidebarToggle = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  // Handle search functionality from header
  const handleSearch = useCallback(async (query: string) => {
    try {
      // Search implementation would go here
      console.log('Searching for:', query);
    } catch (error) {
      console.error('Search error:', error);
    }
  }, []);

  // Update sidebar state on screen size changes
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  // Store sidebar preference in localStorage for authenticated users
  useEffect(() => {
    if (isAuthenticated && !isMobile) {
      const storedPreference = localStorage.getItem('sidebarOpen');
      if (storedPreference !== null) {
        setSidebarOpen(storedPreference === 'true');
      }
    }
  }, [isAuthenticated, isMobile]);

  // Save sidebar preference when it changes
  useEffect(() => {
    if (isAuthenticated && !isMobile) {
      localStorage.setItem('sidebarOpen', String(sidebarOpen));
    }
  }, [sidebarOpen, isAuthenticated, isMobile]);

  return (
    <LayoutContainer className={className}>
      {/* Header with search functionality */}
      <Header
        onSearch={handleSearch}
        onMenuClick={handleSidebarToggle}
        isAuthenticated={isAuthenticated}
        user={user}
      />

      <MainContainer>
        {/* Responsive sidebar navigation */}
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isAuthenticated={isAuthenticated}
        />

        {/* Main content area with loading state support */}
        <ContentWrapper>
          <MainContent
            loading={loading}
            role="main"
            aria-label="Main content"
          >
            {children}
          </MainContent>
        </ContentWrapper>
      </MainContainer>
    </LayoutContainer>
  );
};

// Export with display name for debugging
MainLayout.displayName = 'MainLayout';

export default MainLayout;