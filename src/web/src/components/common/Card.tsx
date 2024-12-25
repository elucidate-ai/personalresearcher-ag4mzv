import React, { useCallback, useEffect, useRef } from 'react';
import { Card as MuiCard, CardContent } from '@mui/material'; // v5.0.0
import { styled, useTheme } from '@mui/material/styles'; // v5.0.0

// Interface for Card component props with comprehensive accessibility support
export interface CardProps {
  children: React.ReactNode;
  className?: string;
  elevation?: number;
  onClick?: () => void;
  role?: string;
  tabIndex?: number;
  ariaLabel?: string;
  testId?: string;
}

// Styled wrapper for MUI Card with responsive design and theme integration
const StyledCard = styled(MuiCard)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  transition: 'all 0.3s ease-in-out',
  padding: theme.spacing(2),
  margin: theme.spacing(1),
  minHeight: '100px',
  width: '100%',
  outline: 'none',
  cursor: 'default',

  // Responsive styles using theme breakpoints
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1),
    margin: theme.spacing(0.5),
  },
  [theme.breakpoints.between('sm', 'md')]: {
    padding: theme.spacing(1.5),
    margin: theme.spacing(0.75),
  },
  [theme.breakpoints.up('md')]: {
    padding: theme.spacing(2),
    margin: theme.spacing(1),
  },

  // Interactive states
  '&:hover': {
    transform: ({ onClick }) => onClick ? 'translateY(-2px)' : 'none',
    boxShadow: ({ elevation }) => onClick ? theme.shadows[elevation + 1] : theme.shadows[elevation],
  },
  '&:focus': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
  '&:focus:not(:focus-visible)': {
    outline: 'none',
  },
}));

/**
 * A reusable card component that provides consistent styling and interaction patterns
 * with built-in accessibility support and responsive design.
 * 
 * @param {CardProps} props - The props for the Card component
 * @returns {JSX.Element} A styled and accessible card component
 */
export const Card = React.memo<CardProps>(({
  children,
  className,
  elevation = 1,
  onClick,
  role = 'article',
  tabIndex = 0,
  ariaLabel,
  testId,
}) => {
  const theme = useTheme();
  const cardRef = useRef<HTMLDivElement>(null);

  // Handle keyboard interactions for accessibility
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!onClick) return;
    
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  }, [onClick]);

  // Set up and clean up keyboard event listeners
  useEffect(() => {
    const currentRef = cardRef.current;
    if (currentRef && onClick) {
      currentRef.addEventListener('keydown', handleKeyDown);
      return () => {
        currentRef.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [handleKeyDown, onClick]);

  return (
    <StyledCard
      ref={cardRef}
      className={className}
      elevation={elevation}
      onClick={onClick}
      role={role}
      tabIndex={onClick ? tabIndex : -1}
      aria-label={ariaLabel}
      data-testid={testId}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <CardContent>
        {children}
      </CardContent>
    </StyledCard>
  );
});

// Display name for debugging purposes
Card.displayName = 'Card';

export default Card;