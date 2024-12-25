/**
 * Export Dialog Component
 * @version 1.0.0
 * @description A modal dialog interface for configuring and managing document export operations
 * with enhanced security, accessibility, and error handling capabilities.
 */

import React, { useCallback, useState, useEffect } from 'react';
import styled from '@emotion/styled';
import Dialog from '../common/Dialog';
import ExportFormatSelect from './ExportFormatSelect';
import ExportProgress from './ExportProgress';
import ExportOptions from './ExportOptions';
import { useExport } from '../../hooks/useExport';
import { ExportFormat, ExportError } from '../../types/export.types';

// Styled components for dialog content
const StyledDialogContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  min-width: 320px;
  max-width: 600px;
  width: 100%;

  @media (min-width: 640px) {
    min-width: 480px;
  }
`;

const StyledErrorMessage = styled.div`
  color: ${props => props.theme.colors.error};
  padding: 0.75rem;
  margin-top: 0.5rem;
  border-radius: 0.25rem;
  background-color: ${props => `${props.theme.colors.error}10`};
  font-size: 0.875rem;
`;

// Props interface for the ExportDialog component
export interface ExportDialogProps {
  /** Controls dialog visibility */
  open: boolean;
  /** Handler for dialog close events with cleanup */
  onClose: () => void;
  /** IDs of content to be exported */
  contentIds: string[];
  /** Token for validating export operations */
  securityToken: string;
  /** Maximum allowed export size in bytes */
  maxExportSize: number;
  /** Error handler callback */
  onError: (error: ExportError) => void;
}

/**
 * ExportDialog component that provides a modal interface for configuring
 * and managing document export operations.
 */
export const ExportDialog: React.FC<ExportDialogProps> = ({
  open,
  onClose,
  contentIds,
  securityToken,
  maxExportSize,
  onError
}) => {
  // State management
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(ExportFormat.MARKDOWN);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Custom hook for export operations
  const { 
    exportState,
    isExporting,
    error: exportError,
    startExport,
    downloadExport
  } = useExport();

  // Handle export format selection
  const handleFormatChange = useCallback((format: ExportFormat) => {
    setSelectedFormat(format);
    setValidationError(null);
  }, []);

  // Handle export initiation with validation
  const handleExportStart = useCallback(async (options: any) => {
    try {
      // Validate content selection
      if (!contentIds.length) {
        throw new Error('No content selected for export');
      }

      // Validate export size
      const estimatedSize = contentIds.length * 1024 * 1024; // Rough estimate
      if (estimatedSize > maxExportSize) {
        throw new Error('Selected content exceeds maximum export size');
      }

      // Validate security token
      if (!securityToken) {
        throw new Error('Invalid security token');
      }

      // Start export process
      await startExport({
        ...options,
        contentIds,
        format: selectedFormat,
        securityToken
      });

    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Export failed');
      onError(error as ExportError);
    }
  }, [contentIds, maxExportSize, securityToken, selectedFormat, startExport, onError]);

  // Handle export completion
  const handleExportComplete = useCallback(async (exportId: string) => {
    try {
      await downloadExport(exportId);
      onClose();
    } catch (error) {
      onError(error as ExportError);
    }
  }, [downloadExport, onClose, onError]);

  // Handle errors
  useEffect(() => {
    if (exportError) {
      setValidationError(exportError.message);
      onError(exportError);
    }
  }, [exportError, onError]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Export Content"
      size="medium"
      loading={isExporting}
      disableBackdropClick={isExporting}
      disableEscapeKeyDown={isExporting}
      aria-labelledby="export-dialog-title"
      aria-describedby="export-dialog-description"
    >
      <StyledDialogContent role="dialog" aria-modal="true">
        {!isExporting ? (
          <>
            <ExportFormatSelect
              value={selectedFormat}
              onChange={handleFormatChange}
              disabled={isExporting}
              error={!!validationError}
              helperText={validationError}
            />

            <ExportOptions
              contentIds={contentIds}
              onExportStart={handleExportStart}
              onProgress={() => {}}
              onError={(error) => setValidationError(error.message)}
              aria-label="Export options"
            />
          </>
        ) : (
          <ExportProgress
            className="mt-4"
            aria-label="Export progress"
          />
        )}

        {validationError && (
          <StyledErrorMessage role="alert">
            {validationError}
          </StyledErrorMessage>
        )}
      </StyledDialogContent>
    </Dialog>
  );
};

export default ExportDialog;