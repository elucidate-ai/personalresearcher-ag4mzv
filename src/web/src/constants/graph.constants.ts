/**
 * @fileoverview Constants and type definitions for knowledge graph visualization
 * Implements WCAG 2.1 AA compliant colors and comprehensive style definitions
 * for nodes, relationships, and interaction states
 * @version 1.0.0
 */

/**
 * Type-safe enum defining semantic types of knowledge graph nodes
 */
export const NODE_TYPES = {
  CORE: 'core',           // Core/primary concept nodes
  RELATED: 'related',     // Related/supporting concept nodes
  PREREQUISITE: 'prerequisite', // Required prerequisite concept nodes
  EXPANSION: 'expansion'   // Expanded/detailed concept nodes
} as const;

/**
 * Type for strongly-typed NODE_TYPES values
 */
export type NodeType = typeof NODE_TYPES[keyof typeof NODE_TYPES];

/**
 * Type-safe enum defining relationship types between knowledge graph nodes
 */
export const RELATIONSHIP_TYPES = {
  REQUIRES: 'requires',     // Prerequisite relationship
  RELATES_TO: 'relates_to', // General relationship
  EXPANDS_ON: 'expands_on' // Detailed expansion relationship
} as const;

/**
 * Type for strongly-typed RELATIONSHIP_TYPES values
 */
export type RelationshipType = typeof RELATIONSHIP_TYPES[keyof typeof RELATIONSHIP_TYPES];

/**
 * WCAG 2.1 AA compliant color definitions for nodes
 * All colors meet minimum contrast ratio requirements
 */
export const NODE_COLORS = {
  // Primary node type colors
  CORE: '#2563EB',        // Blue 600 - Primary brand color
  RELATED: '#64748B',     // Slate 500 - Secondary color
  PREREQUISITE: '#DC2626', // Red 600 - Warning/Required color
  EXPANSION: '#059669',    // Emerald 600 - Success/Detail color

  // Interaction state colors
  HOVER: '#3B82F6',       // Blue 500 - Hover state
  SELECTED: '#1D4ED8',    // Blue 700 - Selected state
  DISABLED: '#94A3B8'     // Slate 400 - Disabled state
} as const;

/**
 * Comprehensive style definitions for relationship types
 * Including stroke patterns, colors, widths and arrow configurations
 */
export const RELATIONSHIP_STYLES = {
  REQUIRES: {
    strokeDasharray: '5,5',    // Dashed line for prerequisites
    color: '#DC2626',          // Red 600 - Matches prerequisite nodes
    width: 2,                  // Thicker line for emphasis
    opacity: 0.8,              // High opacity for visibility
    arrowHeadType: 'arrow'     // Directional arrow for requirements
  },
  RELATES_TO: {
    strokeDasharray: 'none',   // Solid line for general relationships
    color: '#64748B',          // Slate 500 - Matches related nodes
    width: 1,                  // Standard line width
    opacity: 0.6,              // Medium opacity for de-emphasis
    arrowHeadType: 'none'      // No arrow for bidirectional relationships
  },
  EXPANDS_ON: {
    strokeDasharray: '3,3',    // Dotted line for expansions
    color: '#059669',          // Emerald 600 - Matches expansion nodes
    width: 1.5,                // Medium-thick line
    opacity: 0.7,              // Medium-high opacity
    arrowHeadType: 'arrow'     // Directional arrow for expansions
  }
} as const;

/**
 * Type-safe enum defining interaction states for nodes and relationships
 */
export const INTERACTION_STATES = {
  DEFAULT: 'default',     // Normal state
  HOVER: 'hover',        // Mouse hover state
  SELECTED: 'selected',  // Selected/active state
  DISABLED: 'disabled'   // Disabled/inactive state
} as const;

/**
 * Type for strongly-typed INTERACTION_STATES values
 */
export type InteractionState = typeof INTERACTION_STATES[keyof typeof INTERACTION_STATES];

// Type guard functions for type checking
export const isNodeType = (value: string): value is NodeType => {
  return Object.values(NODE_TYPES).includes(value as NodeType);
};

export const isRelationshipType = (value: string): value is RelationshipType => {
  return Object.values(RELATIONSHIP_TYPES).includes(value as RelationshipType);
};

export const isInteractionState = (value: string): value is InteractionState => {
  return Object.values(INTERACTION_STATES).includes(value as InteractionState);
};