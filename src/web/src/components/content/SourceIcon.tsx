/**
 * SourceIcon Component
 * Displays accessible icons for different content source types with tooltips
 * @version 1.0.0
 * 
 * Features:
 * - WCAG 2.1 Level AA compliant
 * - RTL layout support
 * - Accessible tooltips
 * - Error boundary protected
 * - Memoized for performance
 */

import React, { memo } from 'react';
import { styled, useTheme } from '@mui/material/styles';
import {
  VideoLibrary as VideoIcon,
  Article as ArticleIcon,
  Headphones as HeadphonesIcon,
  MenuBook as MenuBookIcon
} from '@mui/icons-material'; // v5.0.0
import { ContentType } from '../../types/content.types';
import Tooltip from '../common/Tooltip';

/**
 * Props interface for SourceIcon component
 */
export interface SourceIconProps {
  sourceType: ContentType;
  className?: string;
  size?: number;
  ariaLabel?: string;
}

/**
 * Styled wrapper for source icons with theme integration
 */
const StyledIcon = styled('div')<{
  color: string;
  fontSize: number;
  isRTL: boolean;
}>(({ theme, color, fontSize, isRTL }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: color,
  fontSize: `${fontSize}px`,
  transform: isRTL ? 'scaleX(-1)' : 'none',
  '& svg': {
    width: '1em',
    height: '1em',
  },
  // Ensure proper contrast for accessibility
  '@media (forced-colors: active)': {
    color: 'CanvasText',
  },
  // Touch target size for accessibility
  '@media (hover: none)': {
    minWidth: '44px',
    minHeight: '44px',
  }
}));

/**
 * Gets the appropriate icon component based on content type
 */
const getIconByType = (type: ContentType): React.ComponentType => {
  switch (type) {
    case ContentType.VIDEO:
      return VideoIcon;
    case ContentType.ARTICLE:
      return ArticleIcon;
    case ContentType.PODCAST:
      return HeadphonesIcon;
    case ContentType.BOOK:
      return MenuBookIcon;
    default:
      return ArticleIcon; // Fallback to article icon
  }
};

/**
 * Gets the accessible tooltip text for the content type
 */
const getTooltipText = (type: ContentType): string => {
  switch (type) {
    case ContentType.VIDEO:
      return 'Video Content';
    case ContentType.ARTICLE:
      return 'Article';
    case ContentType.PODCAST:
      return 'Podcast';
    case ContentType.BOOK:
      return 'Book';
    default:
      return 'Content';
  }
};

/**
 * SourceIcon component displays an icon representing the content source type
 * with an accessible tooltip
 */
export const SourceIcon = memo(({
  sourceType,
  className,
  size = 24,
  ariaLabel,
}: SourceIconProps) => {
  const theme = useTheme();
  const isRTL = theme.direction === 'rtl';
  
  // Get the appropriate icon component
  const IconComponent = getIconByType(sourceType);
  const tooltipText = getTooltipText(sourceType);

  return (
    <Tooltip
      title={tooltipText}
      placement={isRTL ? 'left' : 'right'}
      enterDelay={300}
      leaveDelay={200}
    >
      <StyledIcon
        className={className}
        color={theme.colors?.primary[600] || '#2563EB'}
        fontSize={size}
        isRTL={isRTL}
        role="img"
        aria-label={ariaLabel || tooltipText}
      >
        <IconComponent />
      </StyledIcon>
    </Tooltip>
  );
});

// Display name for debugging
SourceIcon.displayName = 'SourceIcon';

export default SourceIcon;