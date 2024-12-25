/**
 * QualityIndicator Component
 * Visualizes content quality scores through a color-coded indicator with detailed tooltips
 * Implements WCAG 2.1 Level AA accessibility standards
 * @version 1.0.0
 */

import React, { memo } from 'react';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '../common/Tooltip';
import { QualityMetrics } from '../../types/content.types';
import { theme } from '../../config/theme.config';

// Quality score thresholds for color coding
const QUALITY_THRESHOLDS = {
  EXCELLENT: 0.9,
  GOOD: 0.7,
  FAIR: 0.5
} as const;

// Animation duration for color transitions
const ANIMATION_DURATION = 300;

/**
 * Props interface for QualityIndicator component
 */
export interface QualityIndicatorProps {
  score: number;
  size?: 'small' | 'medium' | 'large';
  showTooltip?: boolean;
  className?: string;
  animate?: boolean;
  metrics?: QualityMetrics;
}

/**
 * Styled component for the quality indicator circle
 */
const StyledIndicator = styled('div')<{
  size: 'small' | 'medium' | 'large';
  score: number;
  showTooltip?: boolean;
  animate?: boolean;
}>(({ size, score, showTooltip, animate, theme }) => ({
  width: size === 'small' ? '16px' : size === 'medium' ? '24px' : '32px',
  height: size === 'small' ? '16px' : size === 'medium' ? '24px' : '32px',
  borderRadius: '50%',
  backgroundColor: getQualityColor(score, theme),
  transition: animate ? theme.transitions.create(['background-color'], {
    duration: ANIMATION_DURATION
  }) : 'none',
  cursor: showTooltip ? 'help' : 'default',
  boxShadow: theme.shadows[1],
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0
}));

/**
 * Determines the indicator color based on quality score
 */
const getQualityColor = (score: number, theme: typeof theme) => {
  if (score >= QUALITY_THRESHOLDS.EXCELLENT) {
    return theme.colors.success;
  } else if (score >= QUALITY_THRESHOLDS.GOOD) {
    return theme.colors.warning;
  } else if (score >= QUALITY_THRESHOLDS.FAIR) {
    return theme.colors.warning;
  }
  return theme.colors.error;
};

/**
 * Formats quality metrics for tooltip display
 */
const formatQualityMetrics = (metrics: QualityMetrics, t: (key: string) => string) => (
  <div>
    <div>{t('quality.relevance')}: {Math.round(metrics.relevance * 100)}%</div>
    <div>{t('quality.authority')}: {Math.round(metrics.authority * 100)}%</div>
    <div>{t('quality.freshness')}: {Math.round(metrics.freshness * 100)}%</div>
    <div>{t('quality.completeness')}: {Math.round(metrics.completeness * 100)}%</div>
    <div>{t('quality.readability')}: {Math.round(metrics.readability * 100)}%</div>
  </div>
);

/**
 * QualityIndicator component displays a color-coded circle indicating content quality
 * with optional tooltip showing detailed metrics
 */
export const QualityIndicator = memo(({
  score,
  size = 'medium',
  showTooltip = true,
  className,
  animate = true,
  metrics
}: QualityIndicatorProps) => {
  const { t } = useTranslation();

  // Normalize score to ensure it's between 0 and 1
  const normalizedScore = Math.max(0, Math.min(1, score));

  // Generate quality label based on score
  const getQualityLabel = () => {
    if (normalizedScore >= QUALITY_THRESHOLDS.EXCELLENT) {
      return t('quality.excellent');
    } else if (normalizedScore >= QUALITY_THRESHOLDS.GOOD) {
      return t('quality.good');
    } else if (normalizedScore >= QUALITY_THRESHOLDS.FAIR) {
      return t('quality.fair');
    }
    return t('quality.poor');
  };

  // Create tooltip content
  const tooltipContent = (
    <div>
      <div><strong>{getQualityLabel()}</strong></div>
      <div>{t('quality.score')}: {Math.round(normalizedScore * 100)}%</div>
      {metrics && formatQualityMetrics(metrics, t)}
    </div>
  );

  const indicator = (
    <StyledIndicator
      size={size}
      score={normalizedScore}
      showTooltip={showTooltip}
      animate={animate}
      className={className}
      role="img"
      aria-label={`${t('quality.indicator')}: ${getQualityLabel()}`}
      tabIndex={showTooltip ? 0 : -1}
      onKeyPress={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          // Tooltip will be shown on focus
          e.preventDefault();
        }
      }}
    />
  );

  return showTooltip ? (
    <Tooltip
      title={tooltipContent}
      placement="top"
      enterDelay={200}
      leaveDelay={0}
    >
      {indicator}
    </Tooltip>
  ) : indicator;
});

QualityIndicator.displayName = 'QualityIndicator';

export default QualityIndicator;