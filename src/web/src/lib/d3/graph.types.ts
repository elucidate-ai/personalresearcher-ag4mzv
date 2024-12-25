/**
 * @fileoverview D3.js-specific type definitions for knowledge graph visualization
 * Extends core graph types with D3 force simulation properties and behaviors
 * @version 1.0.0
 */

import { SimulationNodeDatum, SimulationLinkDatum } from 'd3'; // v7.0.0
import { IGraphNode, IGraphRelationship } from '../../types/graph.types';

/**
 * Extended node interface combining IGraphNode with D3 force simulation properties
 * Adds position, velocity, and interactive state for visualization
 */
export interface D3Node extends IGraphNode, SimulationNodeDatum {
  // Force simulation position
  x: number;
  y: number;
  
  // Force simulation velocity
  vx: number;
  vy: number;
  
  // Fixed position coordinates (null if not fixed)
  fx: number | null;
  fy: number | null;
  
  // Visual properties
  radius: number;
  selected: boolean;
}

/**
 * Extended link interface combining IGraphRelationship with D3 force simulation properties
 * Adds force simulation specific properties for link behavior
 */
export interface D3Link extends Omit<IGraphRelationship, 'sourceNodeId' | 'targetNodeId'>, SimulationLinkDatum<D3Node> {
  // Force simulation references (overridden from SimulationLinkDatum to be more specific)
  source: D3Node;
  target: D3Node;
  
  // Link index in the simulation
  index: number;
  
  // Force simulation properties
  strength: number;
  distance: number;
}

/**
 * Complete D3 graph data structure with nodes, links, and viewport bounds
 * Used as the primary data structure for graph visualization
 */
export interface D3GraphData {
  // Graph elements
  nodes: D3Node[];
  links: D3Link[];
  
  // Viewport dimensions
  bounds: {
    width: number;
    height: number;
  };
}

/**
 * Configuration options for D3 force simulation behavior
 * Controls physics-based layout parameters
 */
export interface GraphSimulationOptions {
  // Link force parameters
  strength: number;
  distance: number;
  
  // Node force parameters
  charge: number;
  centerForce: number;
  collideRadius: number;
}

/**
 * Type definition for zoom and pan transformations
 * Supports interactive graph navigation
 */
export type ZoomTransform = {
  // Scale factor
  k: number;
  
  // Translation coordinates
  x: number;
  y: number;
  
  // Transform methods
  scale: (x: number) => number;
  translate: (x: number, y: number) => ZoomTransform;
};