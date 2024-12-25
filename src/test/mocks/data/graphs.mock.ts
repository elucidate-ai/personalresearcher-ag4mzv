/**
 * @fileoverview Mock data for knowledge graph testing
 * Provides comprehensive test data for graph visualization and operations
 * @version 1.0.0
 */

import { 
  IGraphNode, 
  IGraphRelationship,
  IGraphData,
  NodeType,
  RelationshipType
} from '../../web/src/types/graph.types';
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

// Constants for mock data generation
const MOCK_TOPIC_ID = 'mock-topic-123';
const DEFAULT_IMPORTANCE_SCORE = 0.75;
const BASE_DATE = new Date('2024-01-01T00:00:00Z');

/**
 * Creates a mock graph node with specified properties
 */
export const createMockNode = (
  label: string,
  type: NodeType,
  properties: Record<string, any> = {},
  importance: number = DEFAULT_IMPORTANCE_SCORE
): IGraphNode => {
  return {
    id: uuidv4(),
    label,
    type,
    importance,
    properties: {
      createdAt: BASE_DATE,
      updatedAt: BASE_DATE,
      version: 1,
      ...properties
    },
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE
  };
};

/**
 * Creates a mock relationship between nodes
 */
export const createMockRelationship = (
  sourceNodeId: string,
  targetNodeId: string,
  type: RelationshipType,
  weight: number = 0.8,
  properties: Record<string, any> = {}
): IGraphRelationship => {
  return {
    id: uuidv4(),
    type,
    sourceNodeId,
    targetNodeId,
    weight,
    properties: {
      createdAt: BASE_DATE,
      updatedAt: BASE_DATE,
      version: 1,
      confidence: 0.85,
      ...properties
    },
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE
  };
};

// Mock nodes representing different node types
export const mockNodes: IGraphNode[] = [
  // Core concept nodes
  createMockNode('Machine Learning', NodeType.CORE_CONCEPT, {}, 0.95),
  createMockNode('Neural Networks', NodeType.CORE_CONCEPT, {}, 0.9),
  createMockNode('Deep Learning', NodeType.CORE_CONCEPT, {}, 0.85),
  
  // Related topic nodes
  createMockNode('Data Science', NodeType.RELATED_TOPIC, {}, 0.7),
  createMockNode('Statistics', NodeType.RELATED_TOPIC, {}, 0.65),
  
  // Prerequisite nodes
  createMockNode('Linear Algebra', NodeType.PREREQUISITE, {}, 0.8),
  createMockNode('Calculus', NodeType.PREREQUISITE, {}, 0.75),
  
  // Expansion nodes
  createMockNode('CNN', NodeType.EXPANSION, {}, 0.6),
  createMockNode('RNN', NodeType.EXPANSION, {}, 0.55)
];

// Mock relationships between nodes
export const mockRelationships: IGraphRelationship[] = [
  // Core concept relationships
  createMockRelationship(
    mockNodes[0].id, // Machine Learning
    mockNodes[1].id, // Neural Networks
    RelationshipType.RELATES_TO,
    0.9
  ),
  createMockRelationship(
    mockNodes[1].id, // Neural Networks
    mockNodes[2].id, // Deep Learning
    RelationshipType.RELATES_TO,
    0.85
  ),
  
  // Prerequisite relationships
  createMockRelationship(
    mockNodes[5].id, // Linear Algebra
    mockNodes[0].id, // Machine Learning
    RelationshipType.REQUIRES,
    0.8
  ),
  createMockRelationship(
    mockNodes[6].id, // Calculus
    mockNodes[0].id, // Machine Learning
    RelationshipType.REQUIRES,
    0.75
  ),
  
  // Related topic relationships
  createMockRelationship(
    mockNodes[0].id, // Machine Learning
    mockNodes[3].id, // Data Science
    RelationshipType.RELATES_TO,
    0.7
  ),
  
  // Expansion relationships
  createMockRelationship(
    mockNodes[1].id, // Neural Networks
    mockNodes[7].id, // CNN
    RelationshipType.EXPANDS,
    0.6
  ),
  createMockRelationship(
    mockNodes[1].id, // Neural Networks
    mockNodes[8].id, // RNN
    RelationshipType.EXPANDS,
    0.55
  )
];

// Complete mock graph with metadata
export const mockGraph: IGraphData = {
  nodes: mockNodes,
  relationships: mockRelationships,
  metadata: {
    topicId: MOCK_TOPIC_ID,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
    nodeCount: mockNodes.length,
    relationshipCount: mockRelationships.length,
    averageNodeImportance: mockNodes.reduce((acc, node) => acc + node.importance, 0) / mockNodes.length,
    averageRelationshipWeight: mockRelationships.reduce((acc, rel) => acc + rel.weight, 0) / mockRelationships.length,
    lastProcessedAt: BASE_DATE
  }
};

// Export additional test scenarios
export const emptyGraph: IGraphData = {
  nodes: [],
  relationships: [],
  metadata: {
    topicId: 'empty-topic',
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
    nodeCount: 0,
    relationshipCount: 0,
    averageNodeImportance: 0,
    averageRelationshipWeight: 0,
    lastProcessedAt: BASE_DATE
  }
};

// Large graph for performance testing
export const generateLargeGraph = (nodeCount: number = 100): IGraphData => {
  const nodes: IGraphNode[] = [];
  const relationships: IGraphRelationship[] = [];
  
  // Generate nodes
  for (let i = 0; i < nodeCount; i++) {
    nodes.push(createMockNode(
      `Node ${i}`,
      i % 4 === 0 ? NodeType.CORE_CONCEPT :
      i % 4 === 1 ? NodeType.RELATED_TOPIC :
      i % 4 === 2 ? NodeType.PREREQUISITE :
      NodeType.EXPANSION,
      {},
      0.5 + Math.random() * 0.5
    ));
  }
  
  // Generate relationships (connecting each node to ~3 others)
  nodes.forEach((node, index) => {
    for (let i = 0; i < 3; i++) {
      const targetIndex = (index + i + 1) % nodes.length;
      relationships.push(createMockRelationship(
        node.id,
        nodes[targetIndex].id,
        i === 0 ? RelationshipType.RELATES_TO :
        i === 1 ? RelationshipType.REQUIRES :
        RelationshipType.EXPANDS,
        0.5 + Math.random() * 0.5
      ));
    }
  });
  
  return {
    nodes,
    relationships,
    metadata: {
      topicId: 'large-graph-topic',
      createdAt: BASE_DATE,
      updatedAt: BASE_DATE,
      nodeCount: nodes.length,
      relationshipCount: relationships.length,
      averageNodeImportance: nodes.reduce((acc, node) => acc + node.importance, 0) / nodes.length,
      averageRelationshipWeight: relationships.reduce((acc, rel) => acc + rel.weight, 0) / relationships.length,
      lastProcessedAt: BASE_DATE
    }
  };
};