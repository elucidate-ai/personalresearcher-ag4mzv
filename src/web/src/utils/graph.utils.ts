/**
 * @fileoverview Utility functions for knowledge graph visualization and data transformation
 * Provides high-performance graph layout calculation with WebGL support and worker offloading
 * @version 1.0.0
 */

import { 
  forceSimulation, 
  forceManyBody, 
  forceLink, 
  forceCenter,
  SimulationNodeDatum,
  SimulationLinkDatum 
} from 'd3-force'; // v3.0.0
import { WebGLRenderer, Scene, Camera } from 'three'; // v0.157.0
import Worker from 'worker-loader!./graph.worker'; // v3.0.8
import { 
  IGraphNode, 
  IGraphRelationship, 
  IGraphData,
  NodeType 
} from '../types/graph.types';

/**
 * Constants for graph visualization configuration
 */
const WEBGL_THRESHOLD = 1000;
const FORCE_SIMULATION_CONFIG = {
  alpha: 1,
  alphaDecay: 0.02,
  velocityDecay: 0.4,
  linkStrength: 0.7,
  charge: -30,
  centerForce: 1
};

/**
 * Interface for D3-compatible node data
 */
interface D3Node extends SimulationNodeDatum {
  id: string;
  label: string;
  importance: number;
  x?: number;
  y?: number;
}

/**
 * Interface for D3-compatible link data
 */
interface D3Link extends SimulationLinkDatum<D3Node> {
  source: string;
  target: string;
  weight: number;
}

/**
 * Interface for layout calculation options
 */
interface LayoutOptions {
  width: number;
  height: number;
  useWebGL?: boolean;
  workerEnabled?: boolean;
  simulationIterations?: number;
}

/**
 * Converts IGraphData to D3-compatible format
 * @param graphData Core graph data structure
 * @returns Object containing D3 nodes and links arrays
 */
const convertToD3Format = (graphData: IGraphData): { nodes: D3Node[], links: D3Link[] } => {
  const nodes: D3Node[] = graphData.nodes.map(node => ({
    id: node.id,
    label: node.label,
    importance: node.importance
  }));

  const links: D3Link[] = graphData.relationships.map(rel => ({
    source: rel.sourceNodeId,
    target: rel.targetNodeId,
    weight: rel.weight
  }));

  return { nodes, links };
};

/**
 * Initializes WebGL renderer for large graph visualization
 * @param width Canvas width
 * @param height Canvas height
 * @returns WebGL renderer instance
 */
const initializeWebGLRenderer = (width: number, height: number): WebGLRenderer => {
  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: true
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  return renderer;
};

/**
 * Performance monitoring decorator
 */
function performanceMonitor(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;
  descriptor.value = async function(...args: any[]) {
    const start = performance.now();
    const result = await originalMethod.apply(this, args);
    const duration = performance.now() - start;
    console.debug(`${propertyKey} execution time: ${duration.toFixed(2)}ms`);
    return result;
  };
  return descriptor;
}

/**
 * Error boundary decorator
 */
function errorBoundary(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;
  descriptor.value = async function(...args: any[]) {
    try {
      return await originalMethod.apply(this, args);
    } catch (error) {
      console.error(`Error in ${propertyKey}:`, error);
      throw error;
    }
  };
  return descriptor;
}

/**
 * Calculates force-directed graph layout with performance optimizations
 * @param graphData Input graph data structure
 * @param options Layout calculation options
 * @returns Promise resolving to positioned graph data with renderer context
 */
@performanceMonitor
@errorBoundary
export const calculateGraphLayout = async (
  graphData: IGraphData,
  options: LayoutOptions
): Promise<{
  nodes: D3Node[],
  links: D3Link[],
  renderer?: WebGLRenderer
}> => {
  const { nodes, links } = convertToD3Format(graphData);
  const {
    width,
    height,
    useWebGL = nodes.length > WEBGL_THRESHOLD,
    workerEnabled = nodes.length > WEBGL_THRESHOLD,
    simulationIterations = 300
  } = options;

  // Initialize renderer if WebGL is enabled
  const renderer = useWebGL ? initializeWebGLRenderer(width, height) : undefined;

  // Offload layout calculation to worker if enabled
  if (workerEnabled && window.Worker) {
    const worker = new Worker();
    return new Promise((resolve, reject) => {
      worker.postMessage({
        nodes,
        links,
        width,
        height,
        config: FORCE_SIMULATION_CONFIG,
        iterations: simulationIterations
      });

      worker.onmessage = (event) => {
        worker.terminate();
        resolve({
          nodes: event.data.nodes,
          links: event.data.links,
          renderer
        });
      };

      worker.onerror = (error) => {
        worker.terminate();
        reject(error);
      };
    });
  }

  // Calculate layout in main thread if worker is disabled
  const simulation = forceSimulation<D3Node, D3Link>(nodes)
    .force('charge', forceManyBody().strength(FORCE_SIMULATION_CONFIG.charge))
    .force('link', forceLink<D3Node, D3Link>(links)
      .id(d => d.id)
      .strength(FORCE_SIMULATION_CONFIG.linkStrength)
    )
    .force('center', forceCenter(width / 2, height / 2)
      .strength(FORCE_SIMULATION_CONFIG.centerForce)
    )
    .alpha(FORCE_SIMULATION_CONFIG.alpha)
    .alphaDecay(FORCE_SIMULATION_CONFIG.alphaDecay)
    .velocityDecay(FORCE_SIMULATION_CONFIG.velocityDecay);

  // Run simulation synchronously for specified iterations
  for (let i = 0; i < simulationIterations; ++i) {
    simulation.tick();
  }

  simulation.stop();

  return {
    nodes,
    links,
    renderer
  };
};

/**
 * Utility function to clean up graph visualization resources
 * @param renderer WebGL renderer instance to dispose
 */
export const disposeGraphResources = (renderer?: WebGLRenderer): void => {
  if (renderer) {
    renderer.dispose();
  }
};

/**
 * Calculates node radius based on importance score
 * @param importance Node importance score (0-1)
 * @returns Calculated node radius in pixels
 */
export const calculateNodeRadius = (importance: number): number => {
  const MIN_RADIUS = 5;
  const MAX_RADIUS = 20;
  return MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * importance;
};

/**
 * Calculates link strength based on relationship weight
 * @param weight Relationship weight (0-1)
 * @returns Calculated link strength value
 */
export const calculateLinkStrength = (weight: number): number => {
  const MIN_STRENGTH = 0.1;
  const MAX_STRENGTH = 1.0;
  return MIN_STRENGTH + (MAX_STRENGTH - MIN_STRENGTH) * weight;
};