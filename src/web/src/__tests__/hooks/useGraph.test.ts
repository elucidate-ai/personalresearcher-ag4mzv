/**
 * Test suite for useGraph custom hook
 * Version: 1.0.0
 * Tests graph visualization, state management, WebGL acceleration,
 * accessibility, and performance features
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import 'jest-webgl-canvas-mock';
import { useGraph } from '../../hooks/useGraph';
import { GraphService } from '../../services/graph.service';
import { mockGraph, emptyGraph, generateLargeGraph } from '../../../test/mocks/data/graphs.mock';

// Mock GraphService
jest.mock('../../services/graph.service');

// Mock performance API
const mockPerformanceMetrics = {
  fps: 60,
  renderTime: 16.67,
  memoryUsage: 50000000,
  nodeCount: 100
};

// Mock accessibility state
const mockAccessibilityState = {
  ariaLabel: 'Knowledge graph visualization',
  focusedNodeId: null,
  navigationEnabled: true,
  announcements: []
};

// Test setup
const setupTest = (initialState = {}) => {
  const store = configureStore({
    reducer: {
      graph: (state = initialState, action) => {
        switch (action.type) {
          case 'SET_SELECTED_NODE':
            return { ...state, selectedNodeId: action.payload };
          default:
            return state;
        }
      }
    }
  });

  const wrapper = ({ children }) => (
    <Provider store={store}>{children}</Provider>
  );

  return {
    store,
    wrapper
  };
};

describe('useGraph Hook', () => {
  let mockGraphService: jest.Mocked<GraphService>;

  beforeEach(() => {
    mockGraphService = {
      generateGraph: jest.fn(),
      getGraphState: jest.fn(),
      updateGraph: jest.fn(),
      destroy: jest.fn()
    } as any;

    (GraphService as jest.Mock).mockImplementation(() => mockGraphService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Graph Initialization', () => {
    it('should initialize graph with default options', async () => {
      const { wrapper } = setupTest();
      mockGraphService.generateGraph.mockResolvedValueOnce(mockGraph);
      mockGraphService.getGraphState.mockReturnValue({ value: mockGraph });

      const { result, waitForNextUpdate } = renderHook(
        () => useGraph('test-topic', { width: 800, height: 600 }),
        { wrapper }
      );

      expect(result.current.loading).toBe(true);
      await waitForNextUpdate();

      expect(result.current.graph).toEqual(mockGraph);
      expect(result.current.loading).toBe(false);
      expect(mockGraphService.generateGraph).toHaveBeenCalledWith(
        'test-topic',
        expect.any(Object)
      );
    });

    it('should handle empty graph state', async () => {
      const { wrapper } = setupTest();
      mockGraphService.generateGraph.mockResolvedValueOnce(emptyGraph);
      mockGraphService.getGraphState.mockReturnValue({ value: emptyGraph });

      const { result, waitForNextUpdate } = renderHook(
        () => useGraph('empty-topic'),
        { wrapper }
      );

      await waitForNextUpdate();

      expect(result.current.graph).toEqual(emptyGraph);
      expect(result.current.graph.nodes).toHaveLength(0);
      expect(result.current.graph.relationships).toHaveLength(0);
    });
  });

  describe('WebGL Acceleration', () => {
    it('should initialize WebGL renderer when enabled', async () => {
      const { wrapper } = setupTest();
      const options = {
        width: 1024,
        height: 768,
        enableWebGL: true
      };

      mockGraphService.generateGraph.mockResolvedValueOnce(mockGraph);
      mockGraphService.getGraphState.mockReturnValue({ value: mockGraph });

      const { result, waitForNextUpdate } = renderHook(
        () => useGraph('test-topic', options),
        { wrapper }
      );

      await waitForNextUpdate();

      expect(GraphService).toHaveBeenCalledWith(expect.objectContaining({
        width: options.width,
        height: options.height,
        antialias: true,
        alpha: true
      }));
    });

    it('should handle WebGL context loss gracefully', async () => {
      const { wrapper } = setupTest();
      const options = { enableWebGL: true };

      mockGraphService.generateGraph.mockRejectedValueOnce(
        new Error('WebGL context lost')
      );

      const { result, waitForNextUpdate } = renderHook(
        () => useGraph('test-topic', options),
        { wrapper }
      );

      await waitForNextUpdate();

      expect(result.current.error).toBeTruthy();
      expect(result.current.accessibility.announcements).toContain(
        'Error loading graph'
      );
    });
  });

  describe('Memory Management', () => {
    it('should handle large graphs efficiently', async () => {
      const { wrapper } = setupTest();
      const largeGraph = generateLargeGraph(1000);
      const options = {
        progressiveLoading: true,
        maxNodes: 1000
      };

      mockGraphService.generateGraph.mockResolvedValueOnce(largeGraph);
      mockGraphService.getGraphState.mockReturnValue({ value: largeGraph });

      const { result, waitForNextUpdate } = renderHook(
        () => useGraph('large-topic', options),
        { wrapper }
      );

      await waitForNextUpdate();

      expect(result.current.graph.nodes.length).toBe(1000);
      expect(result.current.performance.memoryUsage).toBeDefined();
    });

    it('should cleanup resources on unmount', async () => {
      const { wrapper } = setupTest();
      mockGraphService.generateGraph.mockResolvedValueOnce(mockGraph);

      const { unmount } = renderHook(
        () => useGraph('test-topic'),
        { wrapper }
      );

      unmount();

      expect(mockGraphService.destroy).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should provide screen reader announcements', async () => {
      const { wrapper } = setupTest();
      const options = { accessibilityEnabled: true };

      mockGraphService.generateGraph.mockResolvedValueOnce(mockGraph);
      mockGraphService.getGraphState.mockReturnValue({ value: mockGraph });

      const { result, waitForNextUpdate } = renderHook(
        () => useGraph('test-topic', options),
        { wrapper }
      );

      await waitForNextUpdate();

      expect(result.current.accessibility.ariaLabel).toBe(
        'Knowledge graph visualization'
      );
      expect(result.current.containerRef.current).toBeTruthy();
    });

    it('should handle keyboard navigation', async () => {
      const { wrapper } = setupTest();
      mockGraphService.generateGraph.mockResolvedValueOnce(mockGraph);
      mockGraphService.getGraphState.mockReturnValue({ value: mockGraph });

      const { result, waitForNextUpdate } = renderHook(
        () => useGraph('test-topic', { accessibilityEnabled: true }),
        { wrapper }
      );

      await waitForNextUpdate();

      await act(async () => {
        await result.current.handleNodeClick(mockGraph.nodes[0].id, {
          key: 'Enter',
          preventDefault: jest.fn()
        } as unknown as KeyboardEvent);
      });

      expect(result.current.accessibility.focusedNodeId).toBe(
        mockGraph.nodes[0].id
      );
    });
  });

  describe('Progressive Loading', () => {
    it('should load graph data progressively', async () => {
      const { wrapper } = setupTest();
      const options = {
        progressiveLoading: true,
        maxNodes: 500
      };

      const initialGraph = generateLargeGraph(200);
      const fullGraph = generateLargeGraph(500);

      mockGraphService.generateGraph
        .mockResolvedValueOnce(initialGraph)
        .mockResolvedValueOnce(fullGraph);

      mockGraphService.getGraphState
        .mockReturnValueOnce({ value: initialGraph })
        .mockReturnValueOnce({ value: fullGraph });

      const { result, waitForNextUpdate } = renderHook(
        () => useGraph('test-topic', options),
        { wrapper }
      );

      await waitForNextUpdate();

      expect(result.current.graph.nodes.length).toBeGreaterThan(0);
      expect(mockGraphService.generateGraph).toHaveBeenCalledWith(
        'test-topic',
        expect.objectContaining({ progressive: true })
      );
    });

    it('should handle viewport changes during progressive loading', async () => {
      const { wrapper } = setupTest();
      mockGraphService.generateGraph.mockResolvedValueOnce(mockGraph);
      mockGraphService.getGraphState.mockReturnValue({ value: mockGraph });

      const { result, waitForNextUpdate } = renderHook(
        () => useGraph('test-topic', { progressiveLoading: true }),
        { wrapper }
      );

      await waitForNextUpdate();

      await act(async () => {
        await result.current.handleViewportChange({
          width: 1200,
          height: 800
        });
      });

      expect(mockGraphService.updateGraph).toHaveBeenCalledWith(
        'test-topic',
        expect.objectContaining({
          viewport: { width: 1200, height: 800 }
        })
      );
    });
  });
});