import React, { useCallback, useRef } from 'react';
import { styled } from '@mui/material/styles'; // v5.0.0
import Card from '../common/Card';
import {
  NODE_TYPES,
  RELATIONSHIP_TYPES,
  NODE_COLORS,
  RELATIONSHIP_STYLES
} from '../../constants/graph.constants';

// Props interface with comprehensive type definitions
export interface GraphLegendProps {
  className?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  highContrastMode?: boolean;
}

// Styled components with accessibility and responsive design
const StyledLegendContainer = styled(Card)(({ theme }) => ({
  padding: theme.spacing(2),
  maxWidth: '300px',
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.shadows[1],
  borderRadius: theme.shape.borderRadius,
  outline: 'none',
  position: 'relative',

  [theme.breakpoints.down('sm')]: {
    maxWidth: '100%',
    margin: theme.spacing(1),
  },
}));

const StyledLegendTitle = styled('h2')(({ theme }) => ({
  margin: 0,
  marginBottom: theme.spacing(2),
  fontSize: '1.1rem',
  fontWeight: 500,
  color: theme.palette.text.primary,
}));

const StyledLegendSection = styled('div')(({ theme }) => ({
  marginBottom: theme.spacing(3),
  '&:last-child': {
    marginBottom: 0,
  },
}));

const StyledLegendItem = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  marginBottom: theme.spacing(1),
  padding: theme.spacing(0.5),
  borderRadius: theme.shape.borderRadius,
  '&:focus': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
}));

const StyledNodeIndicator = styled('div')<{ color: string; highContrast?: boolean }>(
  ({ theme, color, highContrast }) => ({
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    marginRight: theme.spacing(1),
    backgroundColor: color,
    border: `2px solid ${theme.palette.background.paper}`,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    ...(highContrast && {
      border: `2px solid ${theme.palette.common.black}`,
      outline: `2px solid ${theme.palette.common.white}`,
    }),
  })
);

const StyledRelationshipIndicator = styled('div')<{ style: typeof RELATIONSHIP_STYLES[keyof typeof RELATIONSHIP_TYPES] }>(
  ({ theme, style }) => ({
    width: '32px',
    height: '2px',
    marginRight: theme.spacing(1),
    backgroundColor: style.color,
    opacity: style.opacity,
    borderStyle: style.strokeDasharray === 'none' ? 'solid' : 'dashed',
    borderWidth: style.width,
  })
);

const StyledLabel = styled('span')(({ theme }) => ({
  fontSize: '0.9rem',
  color: theme.palette.text.primary,
  userSelect: 'none',
}));

/**
 * GraphLegend component that displays an accessible legend for the knowledge graph
 * visualization, explaining different node and relationship types
 *
 * @param {GraphLegendProps} props - Component props
 * @returns {JSX.Element} Rendered legend component
 */
export const GraphLegend: React.FC<GraphLegendProps> = ({
  className,
  isCollapsed = false,
  onToggleCollapse,
  highContrastMode = false,
}) => {
  const legendRef = useRef<HTMLDivElement>(null);

  // Handle keyboard navigation within legend items
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && onToggleCollapse) {
      onToggleCollapse();
    }
  }, [onToggleCollapse]);

  return (
    <StyledLegendContainer
      className={className}
      role="complementary"
      aria-label="Knowledge Graph Legend"
      ref={legendRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      testId="graph-legend"
    >
      <StyledLegendTitle id="legend-title">
        Graph Legend
      </StyledLegendTitle>

      {/* Node Types Section */}
      <StyledLegendSection aria-labelledby="node-types-title">
        <StyledLabel id="node-types-title">Node Types</StyledLabel>
        {Object.entries(NODE_TYPES).map(([key, value]) => (
          <StyledLegendItem
            key={`node-${key}`}
            role="listitem"
            tabIndex={0}
            aria-label={`${key.toLowerCase()} node type`}
          >
            <StyledNodeIndicator
              color={NODE_COLORS[key as keyof typeof NODE_COLORS]}
              highContrast={highContrastMode}
              aria-hidden="true"
            />
            <StyledLabel>
              {key.charAt(0) + key.slice(1).toLowerCase().replace('_', ' ')}
            </StyledLabel>
          </StyledLegendItem>
        ))}
      </StyledLegendSection>

      {/* Relationship Types Section */}
      <StyledLegendSection aria-labelledby="relationship-types-title">
        <StyledLabel id="relationship-types-title">Relationship Types</StyledLabel>
        {Object.entries(RELATIONSHIP_TYPES).map(([key, value]) => (
          <StyledLegendItem
            key={`relationship-${key}`}
            role="listitem"
            tabIndex={0}
            aria-label={`${key.toLowerCase().replace('_', ' ')} relationship type`}
          >
            <StyledRelationshipIndicator
              style={RELATIONSHIP_STYLES[value as keyof typeof RELATIONSHIP_TYPES]}
              aria-hidden="true"
            />
            <StyledLabel>
              {key.charAt(0) + key.slice(1).toLowerCase().replace('_', ' ')}
            </StyledLabel>
          </StyledLegendItem>
        ))}
      </StyledLegendSection>
    </StyledLegendContainer>
  );
};

// Add display name for debugging
GraphLegend.displayName = 'GraphLegend';

export default React.memo(GraphLegend);