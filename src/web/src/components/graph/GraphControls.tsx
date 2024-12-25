import React, { memo, useCallback } from 'react';
import styled from 'styled-components';
import { debounce } from 'lodash'; // ^4.17.21
import { useGraph } from '../../hooks/useGraph';
import Button from '../common/Button';

/**
 * Interface for GraphControls component props
 */
interface GraphControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  webGLEnabled?: boolean;
  performanceMode?: boolean;
}

/**
 * Styled container for graph controls with backdrop blur effect
 */
const ControlsContainer = styled.div`
  position: absolute;
  bottom: 16px;
  right: 16px;
  display: flex;
  gap: 8px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  touch-action: none;
  z-index: 1000;

  @media (max-width: 640px) {
    bottom: 8px;
    right: 8px;
  }
`;

/**
 * Styled button component with touch optimization
 */
const ControlButton = styled(Button)`
  width: 40px;
  height: 40px;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: manipulation;
  user-select: none;

  @media (max-width: 640px) {
    width: 48px;
    height: 48px;
  }
`;

/**
 * GraphControls component providing enhanced zoom, pan, and reset controls
 * for the knowledge graph visualization with WebGL support and accessibility
 */
export const GraphControls: React.FC<GraphControlsProps> = memo(({
  onZoomIn,
  onZoomOut,
  onReset,
  webGLEnabled = false,
  performanceMode = false
}) => {
  const { handleViewportChange, useWebGLContext, usePerformanceMonitor } = useGraph();

  /**
   * Enhanced zoom in handler with WebGL optimization
   */
  const handleZoomIn = useCallback(
    debounce((event: React.MouseEvent | React.TouchEvent) => {
      event.preventDefault();
      
      // Apply WebGL optimizations if enabled
      if (webGLEnabled) {
        const context = useWebGLContext();
        if (context) {
          context.setPixelRatio(window.devicePixelRatio);
        }
      }

      // Track performance if enabled
      if (performanceMode) {
        usePerformanceMonitor('zoomIn');
      }

      onZoomIn();
      handleViewportChange({ scale: 'zoomIn' });
    }, 100),
    [onZoomIn, webGLEnabled, performanceMode]
  );

  /**
   * Enhanced zoom out handler with WebGL optimization
   */
  const handleZoomOut = useCallback(
    debounce((event: React.MouseEvent | React.TouchEvent) => {
      event.preventDefault();
      
      // Apply WebGL optimizations if enabled
      if (webGLEnabled) {
        const context = useWebGLContext();
        if (context) {
          context.setPixelRatio(window.devicePixelRatio);
        }
      }

      // Track performance if enabled
      if (performanceMode) {
        usePerformanceMonitor('zoomOut');
      }

      onZoomOut();
      handleViewportChange({ scale: 'zoomOut' });
    }, 100),
    [onZoomOut, webGLEnabled, performanceMode]
  );

  /**
   * Enhanced reset handler with state cleanup
   */
  const handleReset = useCallback(
    debounce((event: React.MouseEvent | React.TouchEvent) => {
      event.preventDefault();
      
      // Clear WebGL context if enabled
      if (webGLEnabled) {
        const context = useWebGLContext();
        if (context) {
          context.clear();
        }
      }

      // Reset performance monitoring
      if (performanceMode) {
        usePerformanceMonitor('reset');
      }

      onReset();
      handleViewportChange({ scale: 1, position: { x: 0, y: 0 } });
    }, 100),
    [onReset, webGLEnabled, performanceMode]
  );

  return (
    <ControlsContainer>
      <ControlButton
        variant="secondary"
        onClick={handleZoomIn}
        aria-label="Zoom in"
        tooltipText="Zoom in graph view"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </ControlButton>

      <ControlButton
        variant="secondary"
        onClick={handleZoomOut}
        aria-label="Zoom out"
        tooltipText="Zoom out graph view"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </ControlButton>

      <ControlButton
        variant="secondary"
        onClick={handleReset}
        aria-label="Reset view"
        tooltipText="Reset graph view"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
      </ControlButton>
    </ControlsContainer>
  );
});

GraphControls.displayName = 'GraphControls';

export default GraphControls;