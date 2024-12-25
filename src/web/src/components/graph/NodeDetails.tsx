/**
 * NodeDetails Component
 * @version 1.0.0
 * @description Enhanced React component for displaying detailed information about selected nodes
 * in the knowledge graph visualization with WebGL optimization and accessibility features.
 */

import React, { useEffect, useCallback, useMemo } from 'react';
import { Typography, Divider, Card, Box, Chip, IconButton, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useGraph } from '../../hooks/useGraph';
import { IGraphNode, NodeType } from '../../types/graph.types';

// Version constants for dependencies
// @mui/material: ^5.0.0
// react: ^18.0.0

/**
 * Props interface for NodeDetails component
 */
interface NodeDetailsProps {
  className?: string;
  ariaLabel?: string;
  testId?: string;
}

/**
 * Styled components for enhanced visual presentation
 */
const StyledDetailsCard = styled(Card)(({ theme }) => ({
  width: 'clamp(300px, 30vw, 500px)',
  maxHeight: 'calc(100vh - var(--header-height))',
  overflow: 'auto',
  position: 'fixed',
  right: theme.spacing(3),
  top: 'var(--header-height)',
  padding: theme.spacing(3),
  scrollBehavior: 'smooth',
  transition: 'all 0.3s ease-in-out',
  boxShadow: theme.shadows[4],
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px'
  }
}));

const NodeTypeChip = styled(Chip)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  fontWeight: 500
}));

const PropertySection = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),
  '& > *:not(:last-child)': {
    marginBottom: theme.spacing(1)
  }
}));

/**
 * Maps node types to human-readable labels with internationalization support
 */
const formatNodeType = (type: NodeType, locale: string = 'en'): string => {
  const typeLabels: Record<NodeType, Record<string, string>> = {
    [NodeType.CORE_CONCEPT]: {
      en: 'Core Concept',
      es: 'Concepto Principal'
    },
    [NodeType.RELATED_TOPIC]: {
      en: 'Related Topic',
      es: 'Tema Relacionado'
    },
    [NodeType.PREREQUISITE]: {
      en: 'Prerequisite',
      es: 'Prerrequisito'
    },
    [NodeType.EXPANSION]: {
      en: 'Expansion',
      es: 'Expansión'
    }
  };

  return typeLabels[type]?.[locale] || typeLabels[type].en;
};

/**
 * NodeDetails component for displaying detailed information about selected nodes
 */
const NodeDetails: React.FC<NodeDetailsProps> = ({
  className,
  ariaLabel = 'Node details panel',
  testId = 'node-details'
}) => {
  const { selectedNodeId, graph, isLoading, error } = useGraph();

  // Find selected node from graph data
  const selectedNode = useMemo(() => {
    if (!graph?.nodes || !selectedNodeId) return null;
    return graph.nodes.find(node => node.id === selectedNodeId);
  }, [graph?.nodes, selectedNodeId]);

  // Calculate importance score color
  const importanceColor = useCallback((importance: number) => {
    if (importance >= 0.8) return 'success';
    if (importance >= 0.5) return 'warning';
    return 'error';
  }, []);

  // Handle keyboard navigation
  const handleKeyboardNav = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      // Close details panel
    }
  }, []);

  // Set up focus management
  useEffect(() => {
    if (selectedNode) {
      const detailsPanel = document.getElementById('node-details-panel');
      detailsPanel?.focus();
    }
  }, [selectedNode]);

  if (isLoading) {
    return (
      <StyledDetailsCard>
        <Typography>Loading node details...</Typography>
      </StyledDetailsCard>
    );
  }

  if (error) {
    return (
      <StyledDetailsCard>
        <Typography color="error">Error loading node details: {error.message}</Typography>
      </StyledDetailsCard>
    );
  }

  if (!selectedNode) {
    return (
      <StyledDetailsCard>
        <Typography>Select a node to view details</Typography>
      </StyledDetailsCard>
    );
  }

  return (
    <StyledDetailsCard
      className={className}
      id="node-details-panel"
      tabIndex={0}
      role="complementary"
      aria-label={ariaLabel}
      data-testid={testId}
      onKeyDown={handleKeyboardNav}
    >
      {/* Node Type Indicator */}
      <NodeTypeChip
        label={formatNodeType(selectedNode.type)}
        color={selectedNode.type === NodeType.CORE_CONCEPT ? 'primary' : 'default'}
        variant="filled"
      />

      {/* Node Label */}
      <Typography variant="h5" component="h2" gutterBottom>
        {selectedNode.label}
      </Typography>

      {/* Importance Score */}
      <Box mb={2} display="flex" alignItems="center" gap={1}>
        <Typography variant="subtitle2" color="textSecondary">
          Importance Score:
        </Typography>
        <Chip
          size="small"
          label={`${Math.round(selectedNode.importance * 100)}%`}
          color={importanceColor(selectedNode.importance)}
        />
      </Box>

      <Divider />

      {/* Properties Section */}
      <PropertySection>
        <Typography variant="h6" gutterBottom>
          Properties
        </Typography>
        {Object.entries(selectedNode.properties).map(([key, value]) => (
          <Box key={key} mb={1}>
            <Typography variant="subtitle2" color="textSecondary">
              {key}:
            </Typography>
            <Typography>{String(value)}</Typography>
          </Box>
        ))}
      </PropertySection>

      {/* Metadata Section */}
      {selectedNode.metadata && (
        <>
          <Divider sx={{ my: 2 }} />
          <PropertySection>
            <Typography variant="h6" gutterBottom>
              Metadata
            </Typography>
            {Object.entries(selectedNode.metadata).map(([key, value]) => (
              <Box key={key} mb={1}>
                <Typography variant="subtitle2" color="textSecondary">
                  {key}:
                </Typography>
                <Typography>
                  {value instanceof Date ? value.toLocaleString() : String(value)}
                </Typography>
              </Box>
            ))}
          </PropertySection>
        </>
      )}
    </StyledDetailsCard>
  );
};

export default NodeDetails;