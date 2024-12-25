/**
 * ContentCard Component
 * Displays content items in a card format with source type indicator, quality score, and metadata
 * @version 1.0.0
 * 
 * Features:
 * - WCAG 2.1 Level AA compliant
 * - RTL support
 * - Mobile optimized
 * - Comprehensive error handling
 */

import React, { useCallback, useMemo } from 'react';
import { styled } from '@mui/material/styles'; // v5.0.0
import { Typography } from '@mui/material'; // v5.0.0
import { Content } from '../../types/content.types';
import { Card } from '../common/Card';
import { QualityIndicator } from './QualityIndicator';
import { SourceIcon } from './SourceIcon';

// Maximum description length for different screen sizes
const MAX_DESCRIPTION_LENGTH = {
  MOBILE: 100,
  TABLET: 150,
  DESKTOP: 200,
};

// Styled components for layout and responsiveness
const StyledCardContent = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  width: '100%',
  position: 'relative',
  [theme.breakpoints.down('sm')]: {
    gap: theme.spacing(1),
  },
}));

const HeaderContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  width: '100%',
}));

const MetadataContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  color: theme.colors?.secondary[600],
  fontSize: theme.typography.fontSize.sm,
  flexWrap: 'wrap',
}));

const TitleContainer = styled(Typography)(({ theme }) => ({
  flex: 1,
  fontWeight: theme.typography.fontWeight.semibold,
  color: theme.colors?.secondary[900],
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
}));

// Props interface with comprehensive type definitions
export interface ContentCardProps {
  /** Content item data */
  content: Content;
  /** Optional click handler */
  onClick?: (content: Content) => void;
  /** Optional CSS class name */
  className?: string;
  /** Loading state indicator */
  isLoading?: boolean;
  /** Test identifier */
  testId?: string;
}

/**
 * Truncates text with proper RTL support and ellipsis
 */
const truncateDescription = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength).trim()}...`;
};

/**
 * Formats the publish date in a localized format
 */
const formatPublishDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
};

/**
 * ContentCard component displays content items with comprehensive metadata
 * and accessibility features
 */
export const ContentCard = React.memo<ContentCardProps>(({
  content,
  onClick,
  className,
  isLoading = false,
  testId,
}) => {
  // Memoize truncated description based on screen size
  const description = useMemo(() => {
    const maxLength = window.innerWidth < 640 
      ? MAX_DESCRIPTION_LENGTH.MOBILE 
      : window.innerWidth < 1024 
        ? MAX_DESCRIPTION_LENGTH.TABLET 
        : MAX_DESCRIPTION_LENGTH.DESKTOP;
    return truncateDescription(content.description, maxLength);
  }, [content.description]);

  // Handle card click with keyboard support
  const handleClick = useCallback(() => {
    if (onClick && !isLoading) {
      onClick(content);
    }
  }, [onClick, content, isLoading]);

  return (
    <Card
      onClick={handleClick}
      className={className}
      elevation={onClick ? 2 : 1}
      role="article"
      aria-busy={isLoading}
      testId={testId}
      ariaLabel={`${content.title} - ${content.type.toLowerCase()} content`}
    >
      <StyledCardContent>
        <HeaderContainer>
          <SourceIcon
            sourceType={content.type}
            size={24}
            ariaLabel={`${content.type.toLowerCase()} content`}
          />
          <TitleContainer variant="h6" component="h3">
            {content.title}
          </TitleContainer>
          <QualityIndicator
            score={content.qualityScore}
            size="medium"
            showTooltip
            metrics={content.analysisResults?.qualityMetrics}
          />
        </HeaderContainer>

        <Typography
          variant="body2"
          color="textSecondary"
          sx={{ marginBottom: 1 }}
        >
          {description}
        </Typography>

        <MetadataContainer>
          {content.metadata.author && (
            <Typography variant="body2" component="span">
              By {content.metadata.author}
            </Typography>
          )}
          {content.metadata.publisher && (
            <Typography variant="body2" component="span">
              • {content.metadata.publisher}
            </Typography>
          )}
          <Typography variant="body2" component="span">
            • {formatPublishDate(content.metadata.publishDate)}
          </Typography>
        </MetadataContainer>
      </StyledCardContent>
    </Card>
  );
});

// Display name for debugging
ContentCard.displayName = 'ContentCard';

export default ContentCard;