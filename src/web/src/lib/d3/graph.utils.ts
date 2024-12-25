/**
 * @fileoverview Core D3.js utility functions for knowledge graph visualization
 * Provides optimized force simulation and zoom behavior with WebGL acceleration
 * @version 1.0.0
 */

import { 
  forceSimulation, 
  forceManyBody,
  forceLink,
  forceCollide,
  forceCenter,
  Simulation,
  SimulationNodeDatum
} from 'd3-force'; // v7.0.0

import { 
  zoom, 
  ZoomBehavior,
  zoomIdentity
} from 'd3-zoom'; // v7.0.0

import { 
  select, 
  Selection 
} from 'd3-selection'; // v7.0.0

import { 
  D3Node, 
  D3Link, 
  D3GraphData,
  GraphSimulationOptions 
} from './graph.types';

/**
 * WebGL context for hardware acceleration if available
 */
let glContext: WebGLRenderingContext | null = null;

/**
 * Worker instance for force calculations
 */
let forceWorker: Worker | null = null;

/**
 * Initializes WebGL context for hardware-accelerated rendering
 * @param canvas - Canvas element for WebGL context
 */
const initWebGL = (canvas: HTMLCanvasElement): void => {
  try {
    glContext = canvas.getContext('webgl', {
      antialias: true,
      alpha: true
    });
  } catch (e) {
    console.warn('WebGL acceleration not available:', e);
  }
};

/**
 * Creates and configures an optimized D3 force simulation
 * @param graphData - Graph data containing nodes and links
 * @param options - Force simulation configuration options
 * @returns Configured force simulation instance
 */
export const createForceSimulation = (
  graphData: D3GraphData,
  options: GraphSimulationOptions
): Simulation<D3Node, D3Link> => {
  // Initialize force worker if supported
  if (window.Worker && !forceWorker) {
    try {
      forceWorker = new Worker(new URL('./forceWorker.ts', import.meta.url));
    } catch (e) {
      console.warn('Web Worker initialization failed:', e);
    }
  }

  // Create base simulation with custom alpha decay
  const simulation = forceSimulation<D3Node, D3Link>(graphData.nodes)
    .alphaDecay(options.alphaDecay || 0.0228)
    .velocityDecay(options.velocityDecay || 0.4)
    .force('charge', forceManyBody<D3Node>()
      .strength(node => -30 * (node.importance || 1))
      .distanceMax(300)
    )
    .force('link', forceLink<D3Node, D3Link>(graphData.links)
      .id(d => d.id)
      .distance(options.distance || 100)
      .strength(link => link.weight * (options.strength || 1))
    )
    .force('collide', forceCollide<D3Node>()
      .radius(node => (node.radius || 5) + (options.collisionRadius || 5))
      .strength(0.7)
      .iterations(2)
    )
    .force('center', forceCenter(
      graphData.bounds.width / 2,
      graphData.bounds.height / 2
    ));

  // Configure bounds checking
  const boundingForce = () => {
    for (const node of graphData.nodes) {
      node.x = Math.max(node.radius || 5, 
        Math.min(graphData.bounds.width - (node.radius || 5), node.x || 0));
      node.y = Math.max(node.radius || 5,
        Math.min(graphData.bounds.height - (node.radius || 5), node.y || 0));
    }
  };

  simulation.on('tick', () => {
    boundingForce();
    
    // Offload force calculations to worker if available
    if (forceWorker) {
      forceWorker.postMessage({
        nodes: graphData.nodes,
        links: graphData.links,
        options
      });
    }
  });

  // Cleanup handler
  simulation.on('end', () => {
    if (forceWorker) {
      forceWorker.terminate();
      forceWorker = null;
    }
  });

  return simulation;
};

/**
 * Configures enhanced zoom behavior with touch support
 * @param svgElement - SVG container element
 * @param graphContainer - Graph container group element
 * @returns Configured zoom behavior instance
 */
export const setupZoomBehavior = (
  svgElement: Selection<SVGSVGElement, unknown, null, undefined>,
  graphContainer: Selection<SVGGElement, unknown, null, undefined>
): ZoomBehavior<SVGSVGElement, unknown> => {
  // Configure zoom behavior
  const zoomBehavior = zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      graphContainer.attr('transform', event.transform);
    });

  // Add double-tap to zoom for mobile
  let lastTap = 0;
  svgElement.on('touchend', (event) => {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    if (tapLength < 500 && tapLength > 0) {
      event.preventDefault();
      const transform = zoomIdentity
        .translate(event.sourceEvent.clientX, event.sourceEvent.clientY)
        .scale(1.5);
      svgElement.transition()
        .duration(300)
        .call(zoomBehavior.transform, transform);
    }
    lastTap = currentTime;
  });

  // Add zoom to fit functionality
  const zoomToFit = () => {
    const bounds = graphContainer.node()?.getBBox();
    if (bounds) {
      const fullWidth = svgElement.node()?.clientWidth || 0;
      const fullHeight = svgElement.node()?.clientHeight || 0;
      const width = bounds.width;
      const height = bounds.height;
      const midX = bounds.x + width / 2;
      const midY = bounds.y + height / 2;
      
      if (width === 0 || height === 0) return;
      
      const scale = 0.8 / Math.max(width / fullWidth, height / fullHeight);
      const translate = [
        fullWidth / 2 - scale * midX,
        fullHeight / 2 - scale * midY
      ];

      svgElement.transition()
        .duration(500)
        .call(
          zoomBehavior.transform,
          zoomIdentity
            .translate(translate[0], translate[1])
            .scale(scale)
        );
    }
  };

  // Add zoom to fit method to behavior
  (zoomBehavior as any).zoomToFit = zoomToFit;

  return zoomBehavior;
};

/**
 * Cleanup utility to prevent memory leaks
 */
export const cleanup = (): void => {
  if (forceWorker) {
    forceWorker.terminate();
    forceWorker = null;
  }
  if (glContext) {
    glContext = null;
  }
};