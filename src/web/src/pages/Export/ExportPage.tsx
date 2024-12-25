import React, { useState, useCallback, useEffect } from 'react';
import styled from '@emotion/styled';
import { Box, CircularProgress, Alert } from '@mui/material';
import MainContent from '../../components/layout/MainContent';
import ExportDialog from '../../components/export/ExportDialog';
import { useExport } from '../../hooks/useExport';
import { ExportFormat, ExportOptions, ExportProgress, ExportError } from '../../types/export.types';

// Styled components for enhanced layout and accessibility
const ExportPageContainer = styled(Box)`
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 2rem;
  min-height: 100vh;
  background-color: ${props => props.theme.colors.secondary[50]};
`;

const ExportHeader = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 1rem;
  border-bottom: 1px solid ${props => props.theme.colors.secondary[200]};
`;

const ExportContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
`;

const ExportStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-radius: ${props => props.theme.borderRadius.md};
  background-color: ${props => props.theme.colors.secondary[100]};
`;

// Props interface for the ExportPage component
interface ExportPageProps {
  contentIds: string[];
  securityToken: string;
}

/**
 * ExportPage component that provides a comprehensive interface for managing document exports
 * with enhanced security, accessibility, and error handling features.
 */
const ExportPage: React.FC<ExportPageProps> = React.memo(({ contentIds, securityToken }) => {
  // State management
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentError, setCurrentError] = useState<ExportError | null>(null);

  // Custom hook for export operations
  const {
    exportState,
    isExporting,
    error: exportError,
    startExport,
    cancelExport,
    downloadExport
  } = useExport();

  // Handle dialog open/close
  const handleOpenDialog = useCallback(() => {
    setIsDialogOpen(true);
    setCurrentError(null);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setIsDialogOpen(false);
    if (isExporting) {
      cancelExport();
    }
  }, [isExporting, cancelExport]);

  // Handle export start with security validation
  const handleExportStart = useCallback(async (options: ExportOptions) => {
    try {
      if (!contentIds.length) {
        throw new Error('No content selected for export');
      }

      if (!securityToken) {
        throw new Error('Invalid security token');
      }

      await startExport({
        ...options,
        contentIds,
        securityToken
      });
    } catch (error) {
      setCurrentError(error as ExportError);
    }
  }, [contentIds, securityToken, startExport]);

  // Handle export errors
  useEffect(() => {
    if (exportError) {
      setCurrentError(exportError);
    }
  }, [exportError]);

  // Handle export completion
  useEffect(() => {
    if (exportState?.status === 'COMPLETED') {
      downloadExport(exportState.exportId);
      handleCloseDialog();
    }
  }, [exportState, downloadExport, handleCloseDialog]);

  return (
    <MainContent>
      <ExportPageContainer role="main" aria-label="Export Management">
        <ExportHeader>
          <h1>Export Content</h1>
          <button
            onClick={handleOpenDialog}
            disabled={!contentIds.length}
            aria-label="Start new export"
          >
            New Export
          </button>
        </ExportHeader>

        <ExportContent>
          {contentIds.length === 0 ? (
            <Alert severity="info">
              Please select content to export
            </Alert>
          ) : (
            <ExportStatus role="status" aria-live="polite">
              <span>{contentIds.length} items selected for export</span>
            </ExportStatus>
          )}

          {currentError && (
            <Alert 
              severity="error"
              onClose={() => setCurrentError(null)}
              role="alert"
            >
              {currentError.message}
            </Alert>
          )}

          {isExporting && (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress 
                aria-label="Export in progress"
                size={40}
              />
            </Box>
          )}
        </ExportContent>

        <ExportDialog
          open={isDialogOpen}
          onClose={handleCloseDialog}
          contentIds={contentIds}
          securityToken={securityToken}
          maxExportSize={10 * 1024 * 1024} // 10MB limit
          onError={setCurrentError}
        />
      </ExportPageContainer>
    </MainContent>
  );
});

// Display name for debugging
ExportPage.displayName = 'ExportPage';

export default ExportPage;