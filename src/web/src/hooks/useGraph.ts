/**
 * Enhanced React hook for managing knowledge graph state and interactions
 * Version: 1.0.0
 * Provides high-performance graph visualization with WebGL acceleration,
 * accessibility support, and progressive loading capabilities
 */

import { useEffect, useCallback, useRef } from 'react'; // ^18.0.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.0.0
import { graphApi } from '../lib/api/graph.api';
import { GraphService } from '../services/graph.service';
import { IGraphData, IGraphNode, NodeType } from '../types/graph.types';

// Constants for graph interaction and performance
const VIEWPORT_UPDATE_DEBOUNCE = 100;
const PERFORMANCE_SAMPLE_RATE = 0.1;
const ACCESSIBILITY_LABELS = {
  graphContainer: 'Knowledge graph visualization',
  nodeSelected: 'Selected node:',
  loading: 'Loading graph data',
  error: 'Error loading graph'
};

/**
 * Interface for graph hook options
 */
interface GraphHookOptions {
  width: number;
  height: number;
  enableWebGL?: boolean;
  progressiveLoading?: boolean;
  maxNodes?: number;
  accessibilityEnabled?: boolean;
  performanceMonitoring?: boolean;
}

/**
 * Interface for graph performance metrics
 */
interface GraphPerformance {
  fps: number;
  renderTime: number;
  memoryUsage: number;
  nodeCount: number;
}

/**
 * Interface for graph accessibility state
 */
interface GraphAccessibility {
  ariaLabel: string;
  focusedNodeId: string | null;
  navigationEnabled: boolean;
  announcements: string[];
}

/**
 * Enhanced hook for managing knowledge graph state and interactions
 * @param topicId - Topic identifier for graph generation
 * @param options - Configuration options for graph visualization
 * @returns Graph state and interaction handlers
 */
export const useGraph = (
  topicId: string,
  options: GraphHookOptions = {
    width: 800,
    height: 600,
    enableWebGL: true,
    progressiveLoading: true,
    accessibilityEnabled: true,
    performanceMonitoring: true
  }
) => {
  // Redux state management
  const dispatch = useDispatch();
  const selectedNodeId = useSelector((state: any) => state.graph.selectedNodeId);

  // Service and state references
  const graphServiceRef = useRef<GraphService>();
  const containerRef = useRef<HTMLDivElement>(null);
  const performanceRef = useRef<GraphPerformance>({
    fps: 0,
    renderTime: 0,
    memoryUsage: 0,
    nodeCount: 0
  });
  const accessibilityRef = useRef<GraphAccessibility>({
    ariaLabel: ACCESSIBILITY_LABELS.graphContainer,
    focusedNodeId: null,
    navigationEnabled: true,
    announcements: []
  });

  /**
   * Initializes graph service with WebGL support
   */
  const initializeGraphService = useCallback(() => {
    if (options.enableWebGL && !graphServiceRef.current) {
      graphServiceRef.current = new GraphService({
        width: options.width,
        height: options.height,
        antialias: true,
        alpha: true,
        pixelRatio: window.devicePixelRatio
      });
    }
  }, [options.width, options.height, options.enableWebGL]);

  /**
   * Handles secure node selection with accessibility support
   */
  const handleNodeClick = useCallback(async (
    nodeId: string,
    event: React.MouseEvent | KeyboardEvent
  ) => {
    try {
      // Validate input
      const sanitizedNodeId = nodeId.trim();
      if (!sanitizedNodeId) return;

      // Update selection state
      dispatch({ type: 'SET_SELECTED_NODE', payload: sanitizedNodeId });

      // Update accessibility state
      if (options.accessibilityEnabled) {
        const node = graphServiceRef.current?.getGraphState()
          .value?.nodes.find(n => n.id === sanitizedNodeId);
        
        if (node) {
          accessibilityRef.current.focusedNodeId = sanitizedNodeId;
          accessibilityRef.current.announcements.push(
            `${ACCESSIBILITY_LABELS.nodeSelected} ${node.label}`
          );
        }
      }

      // Update WebGL rendering if enabled
      if (graphServiceRef.current && options.enableWebGL) {
        await graphServiceRef.current.updateGraph(topicId, {
          nodes: [{ id: sanitizedNodeId, highlighted: true }]
        });
      }

      // Track interaction metrics
      if (options.performanceMonitoring) {
        trackInteractionMetrics('nodeSelection', { nodeId: sanitizedNodeId });
      }
    } catch (error) {
      console.error('Error handling node selection:', error);
      throw error;
    }
  }, [dispatch, topicId, options.enableWebGL, options.accessibilityEnabled]);

  /**
   * Handles viewport changes with performance optimization
   */
  const handleViewportChange = useCallback((dimensions: { width: number; height: number }) => {
    if (!graphServiceRef.current) return;

    // Debounce viewport updates
    const handler = setTimeout(async () => {
      try {
        // Update WebGL renderer
        if (options.enableWebGL) {
          await graphServiceRef.current.updateGraph(topicId, {
            viewport: dimensions
          });
        }

        // Update accessibility container
        if (options.accessibilityEnabled && containerRef.current) {
          containerRef.current.style.width = `${dimensions.width}px`;
          containerRef.current.style.height = `${dimensions.height}px`;
        }

        // Track performance metrics
        if (options.performanceMonitoring) {
          trackPerformanceMetrics();
        }
      } catch (error) {
        console.error('Error handling viewport change:', error);
      }
    }, VIEWPORT_UPDATE_DEBOUNCE);

    return () => clearTimeout(handler);
  }, [topicId, options.enableWebGL, options.accessibilityEnabled]);

  /**
   * Tracks performance metrics for monitoring
   */
  const trackPerformanceMetrics = useCallback(() => {
    if (!options.performanceMonitoring) return;

    const metrics = {
      fps: Math.round(performance.now() / 1000),
      renderTime: performance.now(),
      memoryUsage: performance.memory?.usedJSHeapSize || 0,
      nodeCount: graphServiceRef.current?.getGraphState().value?.nodes.length || 0
    };

    performanceRef.current = metrics;
  }, [options.performanceMonitoring]);

  /**
   * Tracks interaction metrics for analytics
   */
  const trackInteractionMetrics = useCallback((
    action: string,
    data: Record<string, any>
  ) => {
    if (!options.performanceMonitoring) return;

    // Sample only a percentage of interactions
    if (Math.random() > PERFORMANCE_SAMPLE_RATE) return;

    console.debug('[Graph Interaction]', {
      action,
      data,
      timestamp: new Date().toISOString(),
      performance: performanceRef.current
    });
  }, [options.performanceMonitoring]);

  /**
   * Initializes graph data and setup
   */
  useEffect(() => {
    let mounted = true;

    const initializeGraph = async () => {
      try {
        initializeGraphService();

        if (!graphServiceRef.current) return;

        // Generate initial graph
        const graphData = await graphServiceRef.current.generateGraph(topicId, {
          maxNodes: options.maxNodes,
          progressive: options.progressiveLoading
        });

        if (!mounted) return;

        // Setup accessibility features
        if (options.accessibilityEnabled && containerRef.current) {
          containerRef.current.setAttribute('role', 'application');
          containerRef.current.setAttribute('aria-label', ACCESSIBILITY_LABELS.graphContainer);
        }

        // Initialize performance monitoring
        if (options.performanceMonitoring) {
          trackPerformanceMetrics();
        }
      } catch (error) {
        console.error('Error initializing graph:', error);
        if (options.accessibilityEnabled) {
          accessibilityRef.current.announcements.push(ACCESSIBILITY_LABELS.error);
        }
      }
    };

    initializeGraph();

    return () => {
      mounted = false;
      graphServiceRef.current?.destroy();
    };
  }, [topicId, initializeGraphService]);

  return {
    graph: graphServiceRef.current?.getGraphState().value || null,
    loading: !graphServiceRef.current?.getGraphState().value,
    selectedNodeId,
    handleNodeClick,
    handleViewportChange,
    containerRef,
    performance: performanceRef.current,
    accessibility: accessibilityRef.current
  };
};