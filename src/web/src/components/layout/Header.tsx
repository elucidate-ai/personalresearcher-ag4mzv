/**
 * Header Component
 * @version 1.0.0
 * @description A responsive, accessible header component implementing the application's
 * main navigation, search functionality, and user authentication controls with
 * Material UI v5 integration and WCAG 2.1 AA compliance.
 */

import React, { useState, useCallback } from 'react';
import { styled, useTheme } from '@mui/material/styles'; // ^5.0.0
import { 
  AppBar,
  Toolbar,
  IconButton,
  Menu,
  MenuItem,
  useMediaQuery,
  CircularProgress,
  Box,
  Typography,
  Divider
} from '@mui/material'; // ^5.0.0
import { 
  Menu as MenuIcon,
  AccountCircle,
  Settings as SettingsIcon,
  Help as HelpIcon
} from '@mui/icons-material'; // ^5.0.0

import Button from '../common/Button';
import SearchBar from '../search/SearchBar';
import { useAuth } from '../../hooks/useAuth';

// Constants for responsive breakpoints
const MOBILE_BREAKPOINT = 640;
const TABLET_BREAKPOINT = 1024;
const HEADER_HEIGHT = 64;

// Props interface
interface HeaderProps {
  className?: string;
  onSearch: (query: string) => Promise<void>;
}

// Styled components
const StyledHeader = styled(AppBar)(({ theme }) => ({
  position: 'fixed',
  height: HEADER_HEIGHT,
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.shadows[2],
  zIndex: theme.zIndex.appBar,
  borderBottom: `1px solid ${theme.palette.divider}`,
  '& .MuiToolbar-root': {
    height: '100%',
    padding: theme.spacing(0, 2),
    [theme.breakpoints.up('sm')]: {
      padding: theme.spacing(0, 3),
    },
  },
}));

const StyledNav = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  gap: theme.spacing(2),
}));

const LogoContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  minWidth: 'fit-content',
});

const SearchContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  maxWidth: '600px',
  margin: '0 auto',
  [theme.breakpoints.down('sm')]: {
    display: 'none',
  },
}));

const ActionsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

/**
 * Header component with responsive design and accessibility features
 */
export const Header: React.FC<HeaderProps> = ({ className, onSearch }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(`(max-width:${MOBILE_BREAKPOINT}px)`);
  const { isAuthenticated, user, loading, login, logout } = useAuth();

  // State for user menu
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Menu handlers
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  // Search handler with loading state
  const handleSearch = useCallback(async (query: string) => {
    try {
      setIsSearching(true);
      await onSearch(query);
    } finally {
      setIsSearching(false);
    }
  }, [onSearch]);

  // Auth action handler
  const handleAuthAction = useCallback(async () => {
    if (isAuthenticated) {
      await logout();
    } else {
      await login();
    }
  }, [isAuthenticated, login, logout]);

  return (
    <StyledHeader className={className} position="fixed">
      <Toolbar>
        <StyledNav>
          {isMobile && (
            <IconButton
              edge="start"
              color="inherit"
              aria-label="open menu"
              sx={{ mr: 1 }}
            >
              <MenuIcon />
            </IconButton>
          )}

          <LogoContainer>
            <Typography
              variant="h6"
              component="h1"
              sx={{ fontWeight: 600, color: theme.palette.text.primary }}
            >
              Knowledge Curator
            </Typography>
          </LogoContainer>

          <SearchContainer>
            <SearchBar
              placeholder="Search topics..."
              onSearch={handleSearch}
              fullWidth
            />
          </SearchContainer>

          <ActionsContainer>
            {isSearching && <CircularProgress size={24} />}

            {!isMobile && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<HelpIcon />}
                aria-label="Help"
              >
                Help
              </Button>
            )}

            {loading ? (
              <CircularProgress size={24} />
            ) : (
              <>
                <IconButton
                  aria-label="account settings"
                  aria-controls="user-menu"
                  aria-haspopup="true"
                  onClick={handleMenuOpen}
                  color="inherit"
                >
                  <AccountCircle />
                </IconButton>
                <Menu
                  id="user-menu"
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={handleMenuClose}
                  keepMounted
                  transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                  anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                >
                  {isAuthenticated ? (
                    <>
                      <MenuItem disabled>
                        <Typography variant="body2">
                          {user?.email}
                        </Typography>
                      </MenuItem>
                      <Divider />
                      <MenuItem onClick={handleMenuClose}>
                        <SettingsIcon fontSize="small" sx={{ mr: 1 }} />
                        Settings
                      </MenuItem>
                      <MenuItem onClick={() => {
                        handleAuthAction();
                        handleMenuClose();
                      }}>
                        Logout
                      </MenuItem>
                    </>
                  ) : (
                    <MenuItem onClick={() => {
                      handleAuthAction();
                      handleMenuClose();
                    }}>
                      Login
                    </MenuItem>
                  )}
                </Menu>
              </>
            )}
          </ActionsContainer>
        </StyledNav>
      </Toolbar>
    </StyledHeader>
  );
};

Header.displayName = 'Header';

export default Header;