import React from 'react';
import { render, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest, describe, beforeAll, beforeEach, afterEach, it, expect } from '@jest/globals';

import GraphVisualization from '../../../components/graph/GraphVisualization';
import { mockGraph, generateLargeGraph } from '../../../../test/mocks/data/graphs.mock';
import { useGraph } from '../../../hooks/useGraph';

// Mock WebGL context
const mockWebGLContext = {
  createShader: jest.fn(),
  createProgram: jest.fn(),
  attachShader: jest.fn(),
  linkProgram: jest.fn(),
  getProgramParameter: jest.fn(() => true),
  useProgram: jest.fn(),
  getAttribLocation: jest.fn(),
  getUniformLocation: jest.fn(),
  enableVertexAttribArray: jest.fn(),
  clear: jest.fn(),
  viewport: jest.fn(),
  bufferData: jest.fn(),
  drawArrays: jest.fn()
};

// Mock force simulation worker
const mockWorker = {
  postMessage: jest.fn(),
  terminate: jest.fn()
};

// Mock useGraph hook
jest.mock('../../../hooks/useGraph', () => ({
  useGraph: jest.fn()
}));

describe('GraphVisualization Component', () => {
  // Global test setup
  beforeAll(() => {
    // Mock WebGL context
    HTMLCanvasElement.prototype.getContext = jest.fn(() => mockWebGLContext);
    
    // Mock ResizeObserver
    global.ResizeObserver = class ResizeObserver {
      observe = jest.fn();
      unobserve = jest.fn();
      disconnect = jest.fn();
    };

    // Mock performance API
    global.performance.mark = jest.fn();
    global.performance.measure = jest.fn();
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default useGraph mock implementation
    (useGraph as jest.Mock).mockImplementation(() => ({
      graph: mockGraph,
      handleNodeClick: jest.fn(),
      handleViewportChange: jest.fn(),
      handleTouchInteraction: jest.fn(),
      loading: false,
      error: null
    }));
  });

  afterEach(() => {
    // Cleanup
    jest.resetAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(
      <GraphVisualization
        topicId="test-topic"
        width={800}
        height={600}
        useWebGL={true}
      />
    );

    // Verify basic structure
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelector('canvas')).toBeInTheDocument();
    expect(screen.getByRole('application')).toBeInTheDocument();
  });

  it('initializes WebGL context correctly', () => {
    render(
      <GraphVisualization
        topicId="test-topic"
        width={800}
        height={600}
        useWebGL={true}
      />
    );

    // Verify WebGL context initialization
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith('webgl', {
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
  });

  it('handles graph data updates correctly', async () => {
    const { rerender } = render(
      <GraphVisualization
        topicId="test-topic"
        width={800}
        height={600}
        useWebGL={true}
      />
    );

    // Update with new graph data
    const updatedGraph = {
      ...mockGraph,
      nodes: [...mockGraph.nodes, {
        id: 'new-node',
        label: 'New Node',
        type: 'CORE_CONCEPT',
        importance: 0.8
      }]
    };

    (useGraph as jest.Mock).mockImplementation(() => ({
      graph: updatedGraph,
      handleNodeClick: jest.fn(),
      handleViewportChange: jest.fn(),
      loading: false,
      error: null
    }));

    rerender(
      <GraphVisualization
        topicId="test-topic"
        width={800}
        height={600}
        useWebGL={true}
      />
    );

    await waitFor(() => {
      const nodes = screen.getAllByRole('button');
      expect(nodes.length).toBe(updatedGraph.nodes.length);
    });
  });

  it('handles node selection correctly', async () => {
    const mockHandleNodeClick = jest.fn();
    (useGraph as jest.Mock).mockImplementation(() => ({
      graph: mockGraph,
      handleNodeClick: mockHandleNodeClick,
      handleViewportChange: jest.fn(),
      loading: false,
      error: null
    }));

    render(
      <GraphVisualization
        topicId="test-topic"
        width={800}
        height={600}
        useWebGL={true}
      />
    );

    // Click first node
    const nodes = screen.getAllByRole('button');
    fireEvent.click(nodes[0]);

    expect(mockHandleNodeClick).toHaveBeenCalledWith(
      mockGraph.nodes[0].id,
      expect.any(Object)
    );
  });

  it('handles keyboard navigation correctly', async () => {
    const mockHandleNodeClick = jest.fn();
    (useGraph as jest.Mock).mockImplementation(() => ({
      graph: mockGraph,
      handleNodeClick: mockHandleNodeClick,
      handleViewportChange: jest.fn(),
      loading: false,
      error: null
    }));

    render(
      <GraphVisualization
        topicId="test-topic"
        width={800}
        height={600}
        useWebGL={true}
      />
    );

    // Test keyboard navigation
    const nodes = screen.getAllByRole('button');
    nodes[0].focus();
    fireEvent.keyPress(nodes[0], { key: 'Enter', code: 'Enter' });

    expect(mockHandleNodeClick).toHaveBeenCalled();
  });

  it('handles touch interactions correctly', async () => {
    const mockHandleTouchInteraction = jest.fn();
    (useGraph as jest.Mock).mockImplementation(() => ({
      graph: mockGraph,
      handleNodeClick: jest.fn(),
      handleViewportChange: jest.fn(),
      handleTouchInteraction: mockHandleTouchInteraction,
      loading: false,
      error: null
    }));

    render(
      <GraphVisualization
        topicId="test-topic"
        width={800}
        height={600}
        useWebGL={true}
      />
    );

    const container = screen.getByRole('application');
    
    // Simulate touch events
    fireEvent.touchStart(container, {
      touches: [{ clientX: 0, clientY: 0 }]
    });
    fireEvent.touchMove(container, {
      touches: [{ clientX: 100, clientY: 100 }]
    });
    fireEvent.touchEnd(container);

    expect(mockHandleTouchInteraction).toHaveBeenCalled();
  });

  it('handles large graphs efficiently', async () => {
    const largeGraph = generateLargeGraph(1000);
    (useGraph as jest.Mock).mockImplementation(() => ({
      graph: largeGraph,
      handleNodeClick: jest.fn(),
      handleViewportChange: jest.fn(),
      loading: false,
      error: null
    }));

    const { container } = render(
      <GraphVisualization
        topicId="test-topic"
        width={800}
        height={600}
        useWebGL={true}
      />
    );

    // Verify WebGL is used for large graphs
    expect(container.querySelector('canvas')).toBeInTheDocument();
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalled();
  });

  it('handles errors gracefully', async () => {
    // Mock error state
    (useGraph as jest.Mock).mockImplementation(() => ({
      graph: null,
      handleNodeClick: jest.fn(),
      handleViewportChange: jest.fn(),
      loading: false,
      error: new Error('Failed to load graph')
    }));

    render(
      <GraphVisualization
        topicId="test-topic"
        width={800}
        height={600}
        useWebGL={true}
      />
    );

    // Verify error handling
    expect(screen.getByRole('application')).toBeInTheDocument();
    expect(mockWebGLContext.clear).not.toHaveBeenCalled();
  });

  it('cleans up resources on unmount', () => {
    const { unmount } = render(
      <GraphVisualization
        topicId="test-topic"
        width={800}
        height={600}
        useWebGL={true}
      />
    );

    unmount();

    // Verify cleanup
    expect(mockWorker.terminate).toHaveBeenCalled();
    expect(mockWebGLContext.clear).toHaveBeenCalled();
  });
});