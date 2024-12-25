/**
 * @fileoverview Helper functions for D3.js graph visualization providing utilities for 
 * node positioning, link calculations, event handling, and graph manipulation operations
 * with enhanced type safety and performance optimizations.
 * @version 1.0.0
 */

import { select, Selection } from 'd3-selection'; // v7.0.0
import { drag, DragBehavior } from 'd3-drag'; // v7.0.0
import { throttle } from 'lodash'; // v4.17.21
import { D3Node, D3Link } from './graph.types';
import { IGraphNode } from '../../types/graph.types';
import { Simulation } from 'd3-force';

// Constants for graph visualization parameters
const MIN_NODE_RADIUS = 8;
const MAX_NODE_RADIUS = 24;
const BASE_LINK_DISTANCE = 100;
const DRAG_THROTTLE_MS = 16;

/**
 * Calculates node radius based on importance score with validation and clamping
 * Uses logarithmic scaling to prevent extreme size differences
 * 
 * @param importance - Node importance score (0-1)
 * @returns Clamped radius value between MIN_NODE_RADIUS and MAX_NODE_RADIUS
 */
export const calculateNodeRadius = (importance: number): number => {
  // Validate importance score
  if (importance < 0 || importance > 1) {
    console.warn('Node importance score out of range [0,1], clamping value');
    importance = Math.max(0, Math.min(1, importance));
  }

  // Calculate radius using logarithmic scaling
  const scaleFactor = Math.log10(importance * 9 + 1);
  const baseRadius = MIN_NODE_RADIUS;
  const radiusRange = MAX_NODE_RADIUS - MIN_NODE_RADIUS;
  
  // Return clamped radius value
  return Math.max(
    MIN_NODE_RADIUS,
    Math.min(
      MAX_NODE_RADIUS,
      baseRadius + (radiusRange * scaleFactor)
    )
  );
};

/**
 * Configures drag behavior for graph nodes with touch support and performance optimization
 * Implements throttled position updates and handles fixed node positions
 * 
 * @param nodes - D3 selection of graph nodes
 * @param simulation - D3 force simulation instance
 * @returns Configured drag behavior with event handlers
 */
export const setupDragBehavior = (
  nodes: Selection<any, D3Node, any, any>,
  simulation: Simulation<D3Node, D3Link>
): DragBehavior<any, any, any> => {
  // Create throttled position update function
  const updatePosition = throttle((event: any, d: D3Node) => {
    d.fx = event.x;
    d.fy = event.y;
    simulation.alphaTarget(0.3).restart();
  }, DRAG_THROTTLE_MS);

  // Configure drag behavior
  const dragBehavior = drag<any, D3Node>()
    .on('start', (event: any, d: D3Node) => {
      if (!event.active) {
        simulation.alphaTarget(0.3).restart();
      }
      d.fx = d.x;
      d.fy = d.y;
      
      // Add dragging class for visual feedback
      select(event.sourceEvent.target).classed('dragging', true);
    })
    .on('drag', (event: any, d: D3Node) => {
      updatePosition(event, d);
    })
    .on('end', (event: any, d: D3Node) => {
      if (!event.active) {
        simulation.alphaTarget(0);
      }
      
      // Remove dragging class
      select(event.sourceEvent.target).classed('dragging', false);
      
      // Optionally release fixed position if shift key not pressed
      if (!event.sourceEvent.shiftKey) {
        d.fx = null;
        d.fy = null;
      }
    });

  // Apply drag behavior to nodes
  nodes.call(dragBehavior);
  
  return dragBehavior;
};

/**
 * Calculates optimal distance between linked nodes considering node sizes
 * Adjusts distance based on node importance and maintains minimum spacing
 * 
 * @param source - Source node of the link
 * @param target - Target node of the link
 * @returns Optimal link distance considering node radii
 */
export const calculateLinkDistance = (
  source: D3Node,
  target: D3Node
): number => {
  // Calculate node radii based on importance
  const sourceRadius = calculateNodeRadius(source.importance);
  const targetRadius = calculateNodeRadius(target.importance);
  
  // Calculate base distance with padding
  const combinedRadii = sourceRadius + targetRadius;
  const importanceScale = (source.importance + target.importance) / 2;
  
  // Return scaled distance with minimum spacing
  return BASE_LINK_DISTANCE + 
    combinedRadii + 
    (BASE_LINK_DISTANCE * importanceScale * 0.5);
};

/**
 * Handles node click events with improved selection management and accessibility
 * Supports multi-select with modifier keys and manages selection state
 * 
 * @param node - Clicked node
 * @param event - Mouse or touch event
 * @param onSelectionChange - Optional callback for selection changes
 */
export const handleNodeClick = (
  node: D3Node,
  event: MouseEvent | TouchEvent,
  onSelectionChange?: (selectedNodes: D3Node[]) => void
): void => {
  // Prevent event bubbling
  event.preventDefault();
  event.stopPropagation();
  
  // Handle multi-select with modifier keys
  const isMultiSelect = event instanceof MouseEvent && 
    (event.ctrlKey || event.metaKey);
  
  // Update node selection state
  if (!isMultiSelect) {
    // Clear other selections if not multi-select
    select('.node.selected').classed('selected', false);
  }
  
  const element = event.target as HTMLElement;
  const wasSelected = select(element).classed('selected');
  select(element)
    .classed('selected', !wasSelected)
    .attr('aria-selected', (!wasSelected).toString());
    
  // Update node data
  node.selected = !wasSelected;
  
  // Trigger selection callback if provided
  if (onSelectionChange) {
    const selectedNodes = select('.node.selected').data() as D3Node[];
    onSelectionChange(selectedNodes);
  }
};