/**
 * DashboardPage Component
 * Main dashboard interface providing content discovery and knowledge graph visualization
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { styled, useTheme } from '@mui/material/styles';
import { Grid, Box, Typography } from '@mui/material';
import AppShell from '../../components/layout/AppShell';
import ContentGrid from '../../components/content/ContentGrid';
import GraphVisualization from '../../components/graph/GraphVisualization';
import { useContent } from '../../hooks/useContent';
import { Content } from '../../types/content.types';
import { UI_CONSTANTS } from '../../constants/app.constants';

// Styled components for enhanced layout
const DashboardContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  padding: theme.spacing(3),
  gap: theme.spacing(3),
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default,
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
    gap: theme.spacing(2),
  },
}));

const GraphContainer = styled(Box)(({ theme }) => ({
  height: '500px',
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
  overflow: 'hidden',
  [theme.breakpoints.down('md')]: {
    height: '400px',
  },
  [theme.breakpoints.down('sm')]: {
    height: '300px',
  },
}));

const ContentContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
  overflow: 'hidden',
}));

// Props interface
export interface DashboardPageProps {
  webGLEnabled?: boolean;
  onError?: (error: Error) => void;
}

/**
 * DashboardPage component providing the main interface after authentication
 * Implements content discovery and knowledge graph visualization
 */
const DashboardPage: React.FC<DashboardPageProps> = ({
  webGLEnabled = true,
  onError
}) => {
  const theme = useTheme();
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [graphDimensions, setGraphDimensions] = useState({ width: 0, height: 0 });

  // Initialize content hook with error handling
  const {
    content,
    loading,
    error,
    searchContent,
    getContentById
  } = useContent({
    cacheEnabled: true,
    retryOnError: true,
    performanceMetrics: true
  });

  // Handle content selection
  const handleContentSelect = useCallback(async (selectedContent: Content) => {
    try {
      await getContentById(selectedContent.id);
      setSelectedTopicId(selectedContent.topicId);
    } catch (error) {
      onError?.(error as Error);
    }
  }, [getContentById, onError]);

  // Update graph dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      const graphElement = document.getElementById('graph-container');
      if (graphElement) {
        setGraphDimensions({
          width: graphElement.clientWidth,
          height: graphElement.clientHeight
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Memoized error message component
  const ErrorMessage = useMemo(() => error ? (
    <Typography 
      color="error"
      variant="body1"
      role="alert"
      sx={{ p: 2 }}
    >
      {error.message}
    </Typography>
  ) : null, [error]);

  return (
    <AppShell onError={onError}>
      <DashboardContainer>
        <Grid container spacing={3}>
          {/* Knowledge Graph Section */}
          <Grid item xs={12} lg={8}>
            <GraphContainer id="graph-container">
              {selectedTopicId && (
                <GraphVisualization
                  topicId={selectedTopicId}
                  width={graphDimensions.width}
                  height={graphDimensions.height}
                  webGLEnabled={webGLEnabled}
                />
              )}
            </GraphContainer>
          </Grid>

          {/* Content Discovery Section */}
          <Grid item xs={12} lg={4}>
            <ContentContainer>
              {ErrorMessage}
              <ContentGrid
                onContentSelect={handleContentSelect}
                gridSpacing={UI_CONSTANTS.SPACING.md}
                testId="dashboard-content-grid"
              />
            </ContentContainer>
          </Grid>
        </Grid>
      </DashboardContainer>
    </AppShell>
  );
};

// Display name for debugging
DashboardPage.displayName = 'DashboardPage';

export default DashboardPage;