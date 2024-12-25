import React, { useCallback, useMemo } from 'react'; // ^18.0.0
import { styled, useTheme } from '@mui/material/styles'; // ^5.0.0
import { 
  Drawer, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText,
  useMediaQuery 
} from '@mui/material'; // ^5.0.0
import Button from '../common/Button';
import { UI_CONSTANTS } from '../../constants/app.constants';
import { theme as appTheme } from '../../config/theme.config';

// Styled components for enhanced sidebar appearance
const StyledDrawer = styled(Drawer)(({ theme }) => ({
  width: 280,
  flexShrink: 0,
  '& .MuiDrawer-paper': {
    width: 280,
    boxSizing: 'border-box',
    backgroundColor: theme.palette.background.paper,
    borderRight: `1px solid ${theme.palette.divider}`,
    boxShadow: appTheme.shadows.DEFAULT,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: UI_CONSTANTS.ANIMATION_DURATION.normal,
    }),
  },
}));

const StyledListItem = styled(ListItem)(({ theme }) => ({
  padding: appTheme.spacing[2],
  margin: `${appTheme.spacing[1]} 0`,
  borderRadius: appTheme.borderRadius.DEFAULT,
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  '&.active': {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    '& .MuiListItemIcon-root': {
      color: theme.palette.primary.contrastText,
    },
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
}));

// Interface definitions
interface SidebarProps {
  open: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
}

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  requiresAuth: boolean;
}

/**
 * Sidebar component providing main application navigation with responsive behavior
 * and WCAG 2.1 Level AA compliance
 */
const Sidebar: React.FC<SidebarProps> = ({
  open,
  onClose,
  isAuthenticated,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Navigation items with access control
  const navigationItems = useMemo<NavigationItem[]>(() => [
    {
      id: 'topics',
      label: 'Topic Explorer',
      icon: <span aria-hidden="true">🔍</span>,
      path: '/topics',
      requiresAuth: false,
    },
    {
      id: 'knowledge-graph',
      label: 'Knowledge Graph',
      icon: <span aria-hidden="true">🕸️</span>,
      path: '/graph',
      requiresAuth: false,
    },
    {
      id: 'content',
      label: 'Content Panel',
      icon: <span aria-hidden="true">📄</span>,
      path: '/content',
      requiresAuth: true,
    },
    {
      id: 'export',
      label: 'Export Options',
      icon: <span aria-hidden="true">⬇️</span>,
      path: '/export',
      requiresAuth: true,
    },
  ], []);

  // Handle navigation with accessibility and mobile support
  const handleNavigation = useCallback((path: string) => {
    if (isMobile) {
      onClose();
    }
    // Navigation logic would be implemented here
    console.log(`Navigating to: ${path}`);
  }, [isMobile, onClose]);

  return (
    <StyledDrawer
      variant={isMobile ? 'temporary' : 'persistent'}
      anchor="left"
      open={open}
      onClose={onClose}
      ModalProps={{
        keepMounted: true, // Better mobile performance
      }}
      aria-label="Main navigation"
    >
      <nav role="navigation">
        <List component="ul" aria-label="Navigation menu">
          {navigationItems.map((item) => {
            const isAccessible = !item.requiresAuth || isAuthenticated;
            
            return (
              <StyledListItem
                key={item.id}
                component="li"
                disabled={!isAccessible}
                onClick={() => isAccessible && handleNavigation(item.path)}
                button
                aria-disabled={!isAccessible}
                role="menuitem"
              >
                <ListItemIcon aria-hidden="true">
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    variant: 'body1',
                    style: {
                      fontFamily: appTheme.typography.fontFamily.sans.join(','),
                      fontWeight: appTheme.typography.fontWeight.medium,
                    },
                  }}
                />
              </StyledListItem>
            );
          })}
        </List>
      </nav>

      {isMobile && (
        <Button
          variant="outlined"
          onClick={onClose}
          className="mt-auto mb-4 mx-4"
          aria-label="Close navigation menu"
          fullWidth
        >
          Close Menu
        </Button>
      )}
    </StyledDrawer>
  );
};

// Export with memo for performance optimization
export default React.memo(Sidebar);