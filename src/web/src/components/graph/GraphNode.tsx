/**
 * @fileoverview React component for rendering individual nodes in the knowledge graph
 * Handles node appearance, interactions, and state management with D3.js integration
 * @version 1.0.0
 */

import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import { select } from 'd3-selection'; // v3.0.0
import { drag } from 'd3-drag'; // v3.0.0
import { styled } from '@mui/material/styles'; // v5.0.0
import { IGraphNode, NodeType } from '../../types/graph.types';
import type { D3Node } from '../../lib/d3/graph.types';

// Props interface for the GraphNode component
interface GraphNodeProps {
  node: IGraphNode & D3Node;
  selected: boolean;
  onSelect: (node: IGraphNode) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

// Styled circle element for node visualization
const NodeCircle = styled('circle')(({ theme }) => ({
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out',
  touchAction: 'none',
  '&:hover': {
    filter: 'brightness(1.1)',
    transform: 'scale(1.05)',
  },
  '&:focus': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
  '&[data-selected="true"]': {
    strokeWidth: 3,
    stroke: theme.palette.primary.main,
  },
}));

// Styled text element for node labels
const NodeLabel = styled('text')(({ theme }) => ({
  fontSize: '12px',
  fontFamily: 'Inter, sans-serif',
  pointerEvents: 'none',
  userSelect: 'none',
  fill: theme.palette.text.primary,
  textAnchor: 'middle',
  dominantBaseline: 'middle',
  '&[data-selected="true"]': {
    fontWeight: 'bold',
  },
}));

/**
 * Calculate node radius based on importance score
 * @param importance - Node importance value between 0 and 1
 * @returns Calculated radius in pixels
 */
const getNodeRadius = (importance: number): number => {
  return useMemo(() => {
    const minRadius = 8;
    const maxRadius = 24;
    const normalizedImportance = Math.max(0, Math.min(1, importance));
    return minRadius + (maxRadius - minRadius) * Math.log1p(normalizedImportance);
  }, [importance]);
};

/**
 * Determine node color based on node type
 * @param type - NodeType enum value
 * @returns Color hex code
 */
const getNodeColor = (type: NodeType): string => {
  return useMemo(() => {
    switch (type) {
      case NodeType.CORE_CONCEPT:
        return '#2563EB'; // Primary blue
      case NodeType.RELATED_TOPIC:
        return '#10B981'; // Success green
      case NodeType.PREREQUISITE:
        return '#F59E0B'; // Warning yellow
      case NodeType.EXPANSION:
        return '#6366F1'; // Info purple
      default:
        return '#64748B'; // Default gray
    }
  }, [type]);
};

/**
 * GraphNode component for rendering individual nodes in the knowledge graph
 */
const GraphNode: React.FC<GraphNodeProps> = ({
  node,
  selected,
  onSelect,
  onDragStart,
  onDragEnd,
}) => {
  const nodeRef = useRef<SVGGElement>(null);

  // Calculate visual properties
  const radius = getNodeRadius(node.importance);
  const color = getNodeColor(node.type);

  // Set up D3 drag behavior
  useEffect(() => {
    if (!nodeRef.current) return;

    const dragBehavior = drag<SVGGElement, unknown>()
      .on('start', () => {
        select(nodeRef.current).raise();
        onDragStart();
      })
      .on('drag', (event) => {
        node.fx = event.x;
        node.fy = event.y;
      })
      .on('end', () => {
        node.fx = null;
        node.fy = null;
        onDragEnd();
      });

    select(nodeRef.current).call(dragBehavior);
  }, [node, onDragStart, onDragEnd]);

  // Handle node selection
  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      onSelect(node);
    },
    [node, onSelect]
  );

  // Handle keyboard interaction
  const handleKeyPress = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect(node);
      }
    },
    [node, onSelect]
  );

  return (
    <g
      ref={nodeRef}
      transform={`translate(${node.x},${node.y})`}
      onClick={handleClick}
      onKeyPress={handleKeyPress}
      tabIndex={0}
      role="button"
      aria-label={`${node.label} (${node.type})`}
      aria-pressed={selected}
    >
      <NodeCircle
        r={radius}
        fill={color}
        data-selected={selected}
        data-testid={`node-${node.id}`}
      />
      <NodeLabel
        dy=".35em"
        data-selected={selected}
        aria-hidden="true"
      >
        {node.label}
      </NodeLabel>
    </g>
  );
};

export default GraphNode;