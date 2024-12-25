import React, { useEffect, useCallback, useState } from 'react';
import styled from 'styled-components';
import { useParams } from 'react-router-dom';
import { useWebGL } from '@react-three/fiber';

import { useGraph } from '../../hooks/useGraph';
import GraphVisualization from '../../components/graph/GraphVisualization';
import LoadingSpinner from '../../components/common/LoadingSpinner';

// Interface for URL parameters
interface RouteParams {
  topicId: string;
}

// Interface for component props
interface GraphPageProps {
  className?: string;
}

// Styled components for layout
const PageContainer = styled.div`
  width: 100%;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background: #ffffff;
  touch-action: none;

  @media (max-width: 768px) {
    height: calc(100vh - 56px);
  }
`;

const LoadingContainer = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  role: status;
  aria-live: polite;
`;

const ErrorContainer = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #ef4444;
  text-align: center;
  padding: 1rem;
  max-width: 80%;
  role: alert;
`;

/**
 * GraphPage component that renders an advanced knowledge graph visualization
 * with WebGL acceleration, accessibility features, and responsive design.
 */
const GraphPage: React.FC<GraphPageProps> = ({ className }) => {
  // Extract topic ID from URL parameters
  const { topicId } = useParams<RouteParams>();
  
  // Initialize WebGL context
  const { gl } = useWebGL();
  
  // Track viewport dimensions
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  // Initialize graph state with WebGL support
  const {
    graph,
    loading,
    error,
    handleNodeClick,
    handleViewportChange,
    containerRef,
    performance,
    accessibility
  } = useGraph(topicId, {
    width: dimensions.width,
    height: dimensions.height,
    enableWebGL: !!gl,
    progressiveLoading: true,
    accessibilityEnabled: true,
    performanceMonitoring: true
  });

  /**
   * Handle viewport resize with debouncing
   */
  const handleResize = useCallback(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight - (window.innerWidth <= 768 ? 56 : 0)
      });
    };

    let timeoutId: NodeJS.Timeout;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(updateDimensions, 100);

    return () => clearTimeout(timeoutId);
  }, []);

  // Setup resize listener
  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // Update viewport when dimensions change
  useEffect(() => {
    handleViewportChange(dimensions);
  }, [dimensions, handleViewportChange]);

  // Setup keyboard navigation
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (!graph) return;

      switch (event.key) {
        case 'ArrowRight':
          // Navigate to next node
          break;
        case 'ArrowLeft':
          // Navigate to previous node
          break;
        case 'Enter':
          // Select focused node
          break;
        case 'Escape':
          // Clear selection
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [graph]);

  // Render loading state
  if (loading) {
    return (
      <PageContainer className={className}>
        <LoadingContainer>
          <LoadingSpinner size="large" color="primary" />
          <span className="sr-only">Loading knowledge graph</span>
        </LoadingContainer>
      </PageContainer>
    );
  }

  // Render error state
  if (error) {
    return (
      <PageContainer className={className}>
        <ErrorContainer>
          <h2>Error Loading Graph</h2>
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md"
          >
            Retry
          </button>
        </ErrorContainer>
      </PageContainer>
    );
  }

  return (
    <PageContainer 
      className={className}
      ref={containerRef}
      role="application"
      aria-label="Knowledge graph visualization"
    >
      {graph && (
        <GraphVisualization
          topicId={topicId}
          width={dimensions.width}
          height={dimensions.height}
          useWebGL={!!gl}
        />
      )}
      
      {/* Accessibility announcements */}
      <div 
        aria-live="polite" 
        className="sr-only"
      >
        {accessibility?.announcements.map((announcement, index) => (
          <div key={index}>{announcement}</div>
        ))}
      </div>

      {/* Performance monitoring */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 left-4 text-xs text-gray-500">
          FPS: {performance?.fps.toFixed(1)} | 
          Nodes: {performance?.nodeCount} |
          Memory: {(performance?.memoryUsage / 1024 / 1024).toFixed(1)}MB
        </div>
      )}
    </PageContainer>
  );
};

// Export the component
export default GraphPage;