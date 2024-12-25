/**
 * @fileoverview React component for rendering knowledge graph relationships
 * Handles visualization of edges between nodes with D3.js integration
 * @version 1.0.0
 */

import React, { useMemo, useCallback } from 'react'; // v18.0.0
import { select } from 'd3-selection'; // v7.0.0
import { line, curveBasis } from 'd3-shape'; // v7.0.0
import { IGraphRelationship, RelationshipType } from '../../types/graph.types';
import { D3Link } from '../../lib/d3/graph.types';

/**
 * Props interface for the GraphRelationship component
 */
interface GraphRelationshipProps {
  relationship: IGraphRelationship;
  d3Link: D3Link;
  selected: boolean;
  onSelect: (relationship: IGraphRelationship) => void;
  curveStrength?: number;
}

/**
 * Maps relationship types to stroke colors
 */
const relationshipColors: Record<RelationshipType, string> = {
  [RelationshipType.REQUIRES]: '#E11D48', // Strong requirement (red)
  [RelationshipType.RELATES_TO]: '#2563EB', // Related concept (blue)
  [RelationshipType.EXPANDS]: '#059669', // Expansion (green)
  [RelationshipType.REFERENCES]: '#7C3AED' // Reference (purple)
};

/**
 * Calculates the SVG path for curved relationship lines
 */
const calculatePath = (link: D3Link, curveStrength: number = 30): string => {
  const sourceX = link.source.x || 0;
  const sourceY = link.source.y || 0;
  const targetX = link.target.x || 0;
  const targetY = link.target.y || 0;

  // Calculate control points for the curve
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;
  const normalX = -dy;
  const normalY = dx;
  const length = Math.sqrt(normalX * normalX + normalY * normalY);
  
  const controlX = midX + (normalX / length) * curveStrength;
  const controlY = midY + (normalY / length) * curveStrength;

  // Create curved path using D3 line generator
  const pathGenerator = line<[number, number]>()
    .curve(curveBasis)
    .x(d => d[0])
    .y(d => d[1]);

  return pathGenerator([
    [sourceX, sourceY],
    [controlX, controlY],
    [targetX, targetY]
  ]) || '';
};

/**
 * GraphRelationship component for rendering individual graph relationships
 */
const GraphRelationship: React.FC<GraphRelationshipProps> = ({
  relationship,
  d3Link,
  selected,
  onSelect,
  curveStrength = 30
}) => {
  // Memoize path calculation to prevent unnecessary recalculations
  const pathData = useMemo(() => 
    calculatePath(d3Link, curveStrength),
    [d3Link, curveStrength]
  );

  // Calculate stroke width based on relationship weight (1-5px)
  const strokeWidth = useMemo(() => 
    1 + (relationship.weight * 4),
    [relationship.weight]
  );

  // Handle relationship selection
  const handleClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    onSelect(relationship);
  }, [relationship, onSelect]);

  // Handle relationship hover
  const handleMouseEnter = useCallback(() => {
    select(`#relationship-${relationship.id}`)
      .transition()
      .duration(300)
      .attr('opacity', 0.8);
  }, [relationship.id]);

  const handleMouseLeave = useCallback(() => {
    select(`#relationship-${relationship.id}`)
      .transition()
      .duration(300)
      .attr('opacity', selected ? 1.0 : 0.6);
  }, [relationship.id, selected]);

  return (
    <g
      id={`relationship-${relationship.id}`}
      className="graph-relationship"
      opacity={selected ? 1.0 : 0.6}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="graphics-symbol"
      aria-label={`Relationship of type ${relationship.type}`}
    >
      {/* Arrow marker definition */}
      <defs>
        <marker
          id={`arrow-${relationship.id}`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path
            d="M 0 0 L 10 5 L 0 10 z"
            fill={relationshipColors[relationship.type]}
          />
        </marker>
      </defs>

      {/* Relationship path */}
      <path
        d={pathData}
        stroke={relationshipColors[relationship.type]}
        strokeWidth={strokeWidth}
        fill="none"
        markerEnd={`url(#arrow-${relationship.id})`}
        pointerEvents="stroke"
        style={{
          cursor: 'pointer',
          transition: 'all 300ms ease-in-out'
        }}
      />

      {/* Tooltip title */}
      <title>{`${relationship.type} (Weight: ${relationship.weight.toFixed(2)})`}</title>
    </g>
  );
};

export default React.memo(GraphRelationship);