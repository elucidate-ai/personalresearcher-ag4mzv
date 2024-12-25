/**
 * Graph Slice Test Suite
 * @version 1.0.0
 * @description Comprehensive test suite for graph slice Redux state management
 */

import { configureStore } from '@reduxjs/toolkit'; // ^2.0.0
import { describe, it, expect, beforeEach, jest } from '@jest/globals'; // ^29.0.0
import { performance } from 'perf_hooks';
import graphSlice, {
  setSelectedNode,
  setZoomLevel,
  setViewMode,
  updatePerformanceMetrics,
  updateValidationState,
  resetGraph,
  generateGraphThunk,
  updateGraphThunk,
  GraphViewMode,
  ValidationStatus
} from '../../store/graph/graph.slice';
import { IGraphData, NodeType, RelationshipType } from '../../types/graph.types';

// Test constants
const TEST_TIMEOUT = 5000;
const PERFORMANCE_THRESHOLD = 5000; // 5 seconds max processing time

// Mock graph data
const mockGraphData: IGraphData = {
  nodes: [
    {
      id: '1',
      label: 'Machine Learning',
      type: NodeType.CORE_CONCEPT,
      properties: {
        description: 'Core ML concept',
        importance: 0.9
      },
      importance: 0.9,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '2',
      label: 'Neural Networks',
      type: NodeType.RELATED_TOPIC,
      properties: {
        description: 'Related to ML',
        importance: 0.8
      },
      importance: 0.8,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ],
  relationships: [
    {
      id: '1',
      type: RelationshipType.RELATES_TO,
      sourceNodeId: '1',
      targetNodeId: '2',
      properties: {
        description: 'Fundamental relationship',
        strength: 0.85
      },
      weight: 0.85,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ],
  metadata: {
    topicId: 'ml-basics',
    createdAt: new Date(),
    updatedAt: new Date(),
    nodeCount: 2,
    relationshipCount: 1,
    averageNodeImportance: 0.85,
    averageRelationshipWeight: 0.85,
    lastProcessedAt: new Date()
  }
};

// Helper function to create test store
const createTestStore = (preloadedState?: any) => {
  return configureStore({
    reducer: {
      graph: graphSlice
    },
    preloadedState
  });
};

describe('Graph Slice Tests', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = store.getState().graph;
      expect(state).toEqual({
        data: null,
        loading: false,
        error: null,
        selectedNodeId: null,
        zoomLevel: 1,
        viewMode: GraphViewMode.DEFAULT,
        lastUpdated: 0,
        interactionHistory: [],
        performanceMetrics: {
          lastRenderTime: 0,
          nodeCount: 0,
          relationshipCount: 0
        },
        validationState: {
          status: ValidationStatus.PENDING,
          lastValidated: 0,
          errors: []
        }
      });
    });
  });

  describe('Synchronous Actions', () => {
    it('should handle setSelectedNode', () => {
      store.dispatch(setSelectedNode('1'));
      const state = store.getState().graph;
      expect(state.selectedNodeId).toBe('1');
      expect(state.interactionHistory[0]).toMatchObject({
        action: 'SELECT_NODE',
        nodeId: '1'
      });
    });

    it('should handle setZoomLevel with constraints', () => {
      store.dispatch(setZoomLevel(1.5));
      expect(store.getState().graph.zoomLevel).toBe(1.5);

      store.dispatch(setZoomLevel(0.05));
      expect(store.getState().graph.zoomLevel).toBe(0.1);

      store.dispatch(setZoomLevel(2.5));
      expect(store.getState().graph.zoomLevel).toBe(2);
    });

    it('should handle setViewMode', () => {
      store.dispatch(setViewMode(GraphViewMode.HIERARCHICAL));
      const state = store.getState().graph;
      expect(state.viewMode).toBe(GraphViewMode.HIERARCHICAL);
      expect(state.interactionHistory[0]).toMatchObject({
        action: 'CHANGE_VIEW',
        viewMode: GraphViewMode.HIERARCHICAL
      });
    });

    it('should handle updatePerformanceMetrics', () => {
      const metrics = {
        lastRenderTime: 100,
        nodeCount: 50,
        relationshipCount: 75,
        frameRate: 60
      };
      store.dispatch(updatePerformanceMetrics(metrics));
      expect(store.getState().graph.performanceMetrics).toEqual(metrics);
    });

    it('should handle resetGraph', () => {
      store.dispatch(setSelectedNode('1'));
      store.dispatch(resetGraph());
      const state = store.getState().graph;
      expect(state.data).toBeNull();
      expect(state.selectedNodeId).toBeNull();
      expect(state.interactionHistory[0]).toMatchObject({
        action: 'RESET'
      });
    });
  });

  describe('Async Operations', () => {
    it('should handle generateGraphThunk success', async () => {
      const startTime = performance.now();
      
      const mockResponse = { data: mockGraphData };
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      await store.dispatch(generateGraphThunk({ topicId: 'ml-basics' }));
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      const state = store.getState().graph;
      
      // Verify performance requirements
      expect(processingTime).toBeLessThan(PERFORMANCE_THRESHOLD);
      
      // Verify state updates
      expect(state.data).toEqual(mockGraphData);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.validationState.status).toBe(ValidationStatus.VALID);
      expect(state.performanceMetrics.nodeCount).toBe(mockGraphData.nodes.length);
      expect(state.performanceMetrics.relationshipCount).toBe(mockGraphData.relationships.length);
    }, TEST_TIMEOUT);

    it('should handle generateGraphThunk error', async () => {
      const errorMessage = 'Failed to generate graph';
      jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error(errorMessage));

      await store.dispatch(generateGraphThunk({ topicId: 'invalid-topic' }));
      
      const state = store.getState().graph;
      expect(state.loading).toBe(false);
      expect(state.error).toBe(errorMessage);
      expect(state.validationState.status).toBe(ValidationStatus.INVALID);
      expect(state.validationState.errors).toContain(errorMessage);
    });

    it('should handle updateGraphThunk with performance monitoring', async () => {
      const startTime = performance.now();
      
      const updatedData = {
        ...mockGraphData,
        nodes: [...mockGraphData.nodes, {
          id: '3',
          label: 'Deep Learning',
          type: NodeType.EXPANSION,
          properties: { importance: 0.7 },
          importance: 0.7,
          createdAt: new Date(),
          updatedAt: new Date()
        }]
      };

      const mockResponse = { data: updatedData };
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      await store.dispatch(updateGraphThunk({
        graphId: 'ml-basics',
        updates: { nodes: updatedData.nodes }
      }));

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      const state = store.getState().graph;
      
      expect(processingTime).toBeLessThan(PERFORMANCE_THRESHOLD);
      expect(state.data).toEqual(updatedData);
      expect(state.performanceMetrics.nodeCount).toBe(updatedData.nodes.length);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track render performance', () => {
      const renderTime = 16.7; // 60fps
      store.dispatch(updatePerformanceMetrics({
        lastRenderTime: renderTime,
        frameRate: 60
      }));
      
      const state = store.getState().graph;
      expect(state.performanceMetrics.lastRenderTime).toBe(renderTime);
      expect(state.performanceMetrics.frameRate).toBe(60);
    });

    it('should maintain interaction history', () => {
      const actions = [
        { action: setSelectedNode('1') },
        { action: setZoomLevel(1.5) },
        { action: setViewMode(GraphViewMode.FORCE_DIRECTED) }
      ];

      actions.forEach(({ action }) => store.dispatch(action));
      
      const state = store.getState().graph;
      expect(state.interactionHistory).toHaveLength(3);
      expect(state.interactionHistory.every(item => item.timestamp)).toBe(true);
    });
  });

  describe('Validation States', () => {
    it('should handle validation state updates', () => {
      const validationUpdate = {
        status: ValidationStatus.VALID,
        lastValidated: Date.now(),
        errors: []
      };

      store.dispatch(updateValidationState(validationUpdate));
      
      const state = store.getState().graph;
      expect(state.validationState).toEqual(validationUpdate);
    });

    it('should track validation errors', () => {
      const errorState = {
        status: ValidationStatus.INVALID,
        lastValidated: Date.now(),
        errors: ['Invalid node connection', 'Duplicate node ID']
      };

      store.dispatch(updateValidationState(errorState));
      
      const state = store.getState().graph;
      expect(state.validationState.status).toBe(ValidationStatus.INVALID);
      expect(state.validationState.errors).toHaveLength(2);
    });
  });
});