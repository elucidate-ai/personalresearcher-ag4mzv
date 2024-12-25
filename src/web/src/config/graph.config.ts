/**
 * @fileoverview Configuration for knowledge graph visualization using D3.js
 * Implements WCAG 2.1 AA compliant styling and interaction patterns
 * Supports complex graphs with optimized force simulation parameters
 * @version 1.0.0
 */

import { NODE_TYPES, EDGE_TYPES } from '../constants/graph.constants';
import type { IGraphNode } from '../types/graph.types';
import type { ForceSimulation } from 'd3-force'; // v3.0.0

/**
 * Calculates node radius based on importance score with WCAG-compliant scaling
 * @param importanceScore - Node importance value between 0-1
 * @returns Calculated radius value clamped to configured bounds
 */
export const getNodeRadius = (importanceScore: number): number => {
  const { min, max, default: defaultRadius, scaleFactor } = GraphConfig.nodes.radius;
  const scaledRadius = defaultRadius + (importanceScore * scaleFactor);
  return Math.max(min, Math.min(max, scaledRadius));
};

/**
 * Calculates edge width based on relationship weight with accessibility considerations
 * @param weight - Edge weight value between 0-1
 * @returns Calculated width value clamped to configured bounds
 */
export const getEdgeWidth = (weight: number): number => {
  const { min, max, default: defaultWidth, scaleFactor } = GraphConfig.edges.width;
  const scaledWidth = defaultWidth + (weight * scaleFactor);
  return Math.max(min, Math.min(max, scaledWidth));
};

/**
 * Comprehensive graph visualization configuration
 * Optimized for performance, accessibility, and mobile responsiveness
 */
export const GraphConfig = {
  /**
   * Force simulation parameters optimized for complex graphs
   * Tuned for minimum 10 connections per topic requirement
   */
  simulation: {
    strength: -800, // Repulsion force between nodes
    distance: 200, // Ideal distance between connected nodes
    iterations: 300, // Maximum simulation iterations
    alpha: 1, // Initial simulation intensity
    alphaDecay: 0.0228, // Simulation cool-down rate
    velocityDecay: 0.4, // Node movement damping
    maxNodes: 500, // Maximum supported nodes for performance
    maxEdges: 1000, // Maximum supported edges for performance
    collisionRadius: 1.5, // Node collision prevention factor
  },

  /**
   * Node styling configuration with WCAG 2.1 AA compliant colors
   * Supports dynamic sizing based on importance scores
   */
  nodes: {
    radius: {
      min: 20, // Minimum node size for visibility
      max: 40, // Maximum node size for mobile compatibility
      default: 30, // Base node size
      scaleFactor: 1.5, // Importance score scaling factor
    },
    stroke: {
      width: 2, // Default border width
      color: '#FFFFFF', // High contrast border
      hoverWidth: 3, // Enhanced border on hover
    },
    opacity: {
      default: 0.9,
      hover: 1,
      disabled: 0.3,
      transition: 200, // Transition duration in ms
    },
    colors: {
      [NODE_TYPES.CORE]: '#2563EB', // Blue 600 - Primary
      [NODE_TYPES.RELATED]: '#64748B', // Slate 500 - Secondary
      [NODE_TYPES.PREREQUISITE]: '#DC2626', // Red 600 - Warning
      [NODE_TYPES.EXPANSION]: '#059669', // Emerald 600 - Success
    },
  },

  /**
   * Edge styling configuration with accessibility considerations
   * Supports weight-based visual scaling
   */
  edges: {
    width: {
      min: 1, // Minimum visible width
      max: 4, // Maximum width for clarity
      default: 2, // Base edge width
      scaleFactor: 1.2, // Weight scaling factor
    },
    opacity: {
      default: 0.6,
      hover: 0.9,
      disabled: 0.2,
      transition: 150, // Transition duration in ms
    },
    curve: {
      type: 'curveNatural', // Smooth edge curves
      tension: 0.5, // Curve tension factor
      smoothing: true, // Enable curve smoothing
    },
    colors: {
      [EDGE_TYPES.DIRECT]: '#2563EB', // Blue 600 - Primary
      [EDGE_TYPES.RELATED]: '#64748B', // Slate 500 - Secondary
      [EDGE_TYPES.PREREQUISITE]: '#DC2626', // Red 600 - Warning
    },
  },

  /**
   * Zoom and pan configuration with mobile support
   * Implements smooth transitions and device-specific limits
   */
  zoom: {
    min: 0.25, // Minimum zoom level
    max: 2.5, // Maximum zoom level
    default: 1.0, // Initial zoom level
    step: 0.1, // Zoom increment/decrement step
    duration: 500, // Zoom transition duration in ms
    mobileMin: 0.5, // Mobile-specific minimum zoom
    mobileMax: 2.0, // Mobile-specific maximum zoom
    wheelFactor: 0.05, // Mouse wheel zoom sensitivity
  },

  /**
   * Interaction settings with touch support
   * Implements responsive behavior for all devices
   */
  interaction: {
    dragEnabled: true, // Enable node dragging
    hoverDelay: 100, // Hover effect delay in ms
    clickDelay: 200, // Click registration delay in ms
    doubleTapThreshold: 300, // Double tap detection window in ms
    touchRadius: 20, // Touch target size in pixels
    minMoveDistance: 5, // Minimum drag distance to register movement
  },
} as const;

export default GraphConfig;