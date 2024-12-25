import React, { useEffect, useRef, useCallback, memo } from 'react';
import styled from 'styled-components';
import { select } from 'd3-selection'; // v7.0.0
import REGL from 'regl'; // v2.1.0

import { useGraph } from '../../hooks/useGraph';
import { GraphControls } from './GraphControls';
import { createForceSimulation, setupZoomBehavior, cleanup } from '../../lib/d3/graph.utils';
import { IGraphData } from '../../types/graph.types';

// Styled components for graph visualization
const GraphContainer = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #ffffff;
  touch-action: none;
  outline: none;
  tabIndex: 0;
`;

const GraphCanvas = styled.canvas`
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
`;

const GraphSvg = styled.svg`
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
`;

// Props interface for the visualization component
interface GraphVisualizationProps {
  topicId: string;
  width: number;
  height: number;
  useWebGL?: boolean;
}

/**
 * High-performance, accessible graph visualization component using D3.js and WebGL
 * Implements force-directed layout with progressive loading and virtual rendering
 */
export const GraphVisualization: React.FC<GraphVisualizationProps> = memo(({
  topicId,
  width,
  height,
  useWebGL = true
}) => {
  // Refs for DOM elements and rendering contexts
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reglRef = useRef<REGL.Regl | null>(null);

  // Graph state and interaction handlers from custom hook
  const {
    graph,
    handleNodeClick,
    handleViewportChange,
    useWebGLContext
  } = useGraph(topicId, {
    width,
    height,
    enableWebGL: useWebGL,
    progressiveLoading: true,
    accessibilityEnabled: true,
    performanceMonitoring: true
  });

  /**
   * Initializes WebGL context and REGL instance
   */
  const initializeWebGL = useCallback(() => {
    if (!useWebGL || !canvasRef.current) return;

    try {
      reglRef.current = REGL({
        canvas: canvasRef.current,
        attributes: {
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true
        }
      });
    } catch (error) {
      console.warn('WebGL initialization failed:', error);
    }
  }, [useWebGL]);

  /**
   * Sets up D3 force simulation and zoom behavior
   */
  const initializeVisualization = useCallback((graphData: IGraphData) => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = select(svgRef.current);
    const container = svg.append('g').attr('class', 'graph-container');

    // Initialize force simulation
    const simulation = createForceSimulation(graphData, {
      strength: 0.7,
      distance: 100,
      charge: -30,
      centerForce: 1,
      collideRadius: 5
    });

    // Setup zoom behavior
    const zoom = setupZoomBehavior(svg, container);
    svg.call(zoom);

    // Add nodes
    const nodes = container
      .selectAll('.node')
      .data(graphData.nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('role', 'button')
      .attr('tabindex', 0)
      .attr('aria-label', d => `Node: ${d.label}`)
      .on('click', (event, d) => handleNodeClick(d.id, event))
      .on('keypress', (event, d) => {
        if (event.key === 'Enter' || event.key === ' ') {
          handleNodeClick(d.id, event);
        }
      });

    // Add node circles
    nodes
      .append('circle')
      .attr('r', d => 5 + (d.importance * 5))
      .attr('fill', d => d.type === 'CORE_CONCEPT' ? '#2563EB' : '#64748B')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2);

    // Add node labels
    nodes
      .append('text')
      .attr('dx', 8)
      .attr('dy', '.35em')
      .text(d => d.label)
      .attr('fill', '#1E293B')
      .attr('font-size', '12px')
      .attr('font-family', 'Inter, sans-serif');

    // Add links
    container
      .selectAll('.link')
      .data(graphData.relationships)
      .enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke', '#CBD5E1')
      .attr('stroke-width', d => d.weight * 2)
      .attr('stroke-opacity', 0.6);

    // Update force simulation positions
    simulation.on('tick', () => {
      container
        .selectAll('.link')
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      container
        .selectAll('.node')
        .attr('transform', d => `translate(${d.x},${d.y})`);

      // Update WebGL rendering if enabled
      if (useWebGL && reglRef.current) {
        renderWebGL(graphData);
      }
    });

    return () => {
      simulation.stop();
      cleanup();
    };
  }, [handleNodeClick, useWebGL]);

  /**
   * WebGL rendering function for hardware-accelerated graphics
   */
  const renderWebGL = useCallback((graphData: IGraphData) => {
    if (!reglRef.current || !canvasRef.current) return;

    const regl = reglRef.current;
    
    // Clear previous frame
    regl.clear({
      color: [1, 1, 1, 0],
      depth: 1
    });

    // Draw nodes using WebGL
    const drawNodes = regl({
      vert: `
        precision mediump float;
        attribute vec2 position;
        attribute float size;
        uniform float scale;
        void main() {
          gl_Position = vec4(position, 0, 1);
          gl_PointSize = size * scale;
        }
      `,
      frag: `
        precision mediump float;
        uniform vec4 color;
        void main() {
          gl_FragColor = color;
        }
      `,
      attributes: {
        position: graphData.nodes.map(node => [
          (node.x / width) * 2 - 1,
          (node.y / height) * 2 - 1
        ]),
        size: graphData.nodes.map(node => 5 + (node.importance * 5))
      },
      uniforms: {
        scale: 1,
        color: [0.145, 0.388, 0.922, 1] // Primary blue
      },
      count: graphData.nodes.length,
      primitive: 'points'
    });

    drawNodes();
  }, [width, height]);

  // Initialize visualization when graph data changes
  useEffect(() => {
    if (graph) {
      initializeWebGL();
      initializeVisualization(graph);
    }

    return () => {
      if (reglRef.current) {
        reglRef.current.destroy();
      }
    };
  }, [graph, initializeWebGL, initializeVisualization]);

  // Update dimensions when size changes
  useEffect(() => {
    handleViewportChange({ width, height });
  }, [width, height, handleViewportChange]);

  return (
    <GraphContainer
      ref={containerRef}
      role="application"
      aria-label="Knowledge graph visualization"
    >
      {useWebGL && (
        <GraphCanvas
          ref={canvasRef}
          width={width}
          height={height}
        />
      )}
      <GraphSvg
        ref={svgRef}
        width={width}
        height={height}
        aria-hidden={useWebGL}
      />
      <GraphControls
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onReset={() => {}}
        webGLEnabled={useWebGL}
        performanceMode={true}
      />
    </GraphContainer>
  );
});

GraphVisualization.displayName = 'GraphVisualization';

export default GraphVisualization;