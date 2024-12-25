/**
 * @fileoverview TypeScript type definitions for knowledge graph data structures
 * Defines comprehensive interfaces and enums for nodes, relationships, and metadata
 * supporting the knowledge organization service and graph visualization
 * @version 1.0.0
 */

/**
 * Enum defining all possible node types in the knowledge graph
 * Used for categorizing different types of knowledge nodes
 */
export enum NodeType {
  CORE_CONCEPT = 'CORE_CONCEPT',
  RELATED_TOPIC = 'RELATED_TOPIC',
  PREREQUISITE = 'PREREQUISITE',
  EXPANSION = 'EXPANSION'
}

/**
 * Enum defining all possible relationship types in the knowledge graph
 * Used for categorizing different types of connections between nodes
 */
export enum RelationshipType {
  REQUIRES = 'REQUIRES',
  RELATES_TO = 'RELATES_TO',
  EXPANDS = 'EXPANDS',
  REFERENCES = 'REFERENCES'
}

/**
 * Interface for knowledge graph nodes with metadata and importance scoring
 * Represents individual knowledge points in the graph structure
 */
export interface IGraphNode {
  /** Unique identifier for the node */
  id: string;
  
  /** Display label for the node */
  label: string;
  
  /** Categorization type of the node */
  type: NodeType;
  
  /** Additional node-specific properties */
  properties: Record<string, any>;
  
  /** Importance score (0-1) indicating node significance */
  importance: number;
  
  /** Node creation timestamp */
  createdAt: Date;
  
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Interface for knowledge graph relationships with metadata and weight scoring
 * Represents connections between nodes in the graph structure
 */
export interface IGraphRelationship {
  /** Unique identifier for the relationship */
  id: string;
  
  /** Type of relationship between nodes */
  type: RelationshipType;
  
  /** ID of the source node */
  sourceNodeId: string;
  
  /** ID of the target node */
  targetNodeId: string;
  
  /** Additional relationship-specific properties */
  properties: Record<string, any>;
  
  /** Weight score (0-1) indicating relationship strength */
  weight: number;
  
  /** Relationship creation timestamp */
  createdAt: Date;
  
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Interface for graph metadata including statistical information
 * Contains aggregate data and processing information about the graph
 */
export interface IGraphMetadata {
  /** Associated topic identifier */
  topicId: string;
  
  /** Graph creation timestamp */
  createdAt: Date;
  
  /** Last update timestamp */
  updatedAt: Date;
  
  /** Total number of nodes in the graph */
  nodeCount: number;
  
  /** Total number of relationships in the graph */
  relationshipCount: number;
  
  /** Average importance score across all nodes */
  averageNodeImportance: number;
  
  /** Average weight score across all relationships */
  averageRelationshipWeight: number;
  
  /** Timestamp of last graph processing operation */
  lastProcessedAt: Date;
}

/**
 * Complete graph data structure interface containing nodes, relationships and metadata
 * Primary interface for working with knowledge graph data
 */
export interface IGraphData {
  /** Array of graph nodes */
  nodes: IGraphNode[];
  
  /** Array of relationships between nodes */
  relationships: IGraphRelationship[];
  
  /** Graph metadata and statistics */
  metadata: IGraphMetadata;
}