// External imports with versions
import React, { useCallback, useMemo } from 'react'; // ^18.0.0
import { Tabs as MuiTabs, Tab as MuiTab } from '@mui/material'; // ^5.0.0
import { styled } from '@mui/material/styles'; // ^5.0.0

// Type definitions for tab orientations and variants
const TAB_ORIENTATIONS = ['horizontal', 'vertical'] as const;
const TAB_VARIANTS = ['standard', 'fullWidth', 'scrollable'] as const;

type TabOrientation = typeof TAB_ORIENTATIONS[number];
type TabVariant = typeof TAB_VARIANTS[number];

// Interface for individual tab configuration
export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
  dataTestId?: string;
}

// Props interface for the Tabs component
export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  orientation?: TabOrientation;
  variant?: TabVariant;
  className?: string;
  ariaLabel?: string;
}

// Styled wrapper for MUI Tabs with responsive design
const StyledTabs = styled(MuiTabs, {
  shouldForwardProp: (prop) => prop !== 'orientation',
})<{ orientation?: TabOrientation }>(({ theme, orientation }) => ({
  minHeight: 48,
  borderBottom: orientation === 'horizontal' ? `1px solid ${theme.palette.divider}` : 'none',
  borderRight: orientation === 'vertical' ? `1px solid ${theme.palette.divider}` : 'none',
  transition: theme.transitions.create(['border-color']),
  
  // Responsive styles for different orientations
  ...(orientation === 'vertical' && {
    [theme.breakpoints.up('sm')]: {
      minWidth: 160,
      '& .MuiTabs-indicator': {
        right: 0,
        left: 'auto',
      },
    },
  }),

  // Enhanced focus visibility for accessibility
  '& .MuiTab-root': {
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: -2,
    },
  },
}));

// Helper function to generate accessibility attributes
const a11yProps = (id: string) => ({
  id: `tab-${id}`,
  'aria-controls': `tabpanel-${id}`,
  role: 'tab',
  tabIndex: 0,
});

// Memoized Tabs component with accessibility support
export const Tabs = React.memo<TabsProps>(({
  items,
  value,
  onChange,
  orientation = 'horizontal',
  variant = 'standard',
  className,
  ariaLabel,
}) => {
  // Memoized handler for tab changes
  const handleChange = useCallback((_: React.SyntheticEvent, newValue: string) => {
    onChange(newValue);
  }, [onChange]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const currentIndex = items.findIndex(item => item.id === value);
    let newIndex = currentIndex;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        break;
      case 'Home':
        newIndex = 0;
        break;
      case 'End':
        newIndex = items.length - 1;
        break;
      default:
        return;
    }

    // Skip disabled tabs
    while (items[newIndex].disabled && newIndex !== currentIndex) {
      newIndex = newIndex < items.length - 1 ? newIndex + 1 : 0;
    }

    if (newIndex !== currentIndex && !items[newIndex].disabled) {
      onChange(items[newIndex].id);
      event.preventDefault();
    }
  }, [items, value, onChange]);

  // Memoized tab elements
  const tabElements = useMemo(() => items.map(item => (
    <MuiTab
      key={item.id}
      label={item.label}
      icon={item.icon}
      value={item.id}
      disabled={item.disabled}
      {...a11yProps(item.id)}
      aria-label={item.ariaLabel || item.label}
      data-testid={item.dataTestId}
      sx={{
        minHeight: 48,
        textTransform: 'none',
        '&.Mui-selected': {
          fontWeight: 'bold',
        },
      }}
    />
  )), [items]);

  return (
    <StyledTabs
      value={value}
      onChange={handleChange}
      orientation={orientation}
      variant={variant}
      className={className}
      aria-label={ariaLabel || 'Navigation tabs'}
      onKeyDown={handleKeyDown}
      role="tablist"
      selectionFollowsFocus
      sx={{
        // Ensure proper focus management for screen readers
        '& .MuiTab-root[tabindex="0"]': {
          outline: 'none',
        },
      }}
    >
      {tabElements}
    </StyledTabs>
  );
});

// Display name for debugging
Tabs.displayName = 'Tabs';

// Default export for the component
export default Tabs;