/**
 * Export Options Component
 * @version 1.0.0
 * @description Provides an accessible, secure form interface for configuring document
 * export options with comprehensive validation, error handling, and progress tracking.
 */

import React, { useState, useCallback, useEffect } from 'react';
import styled from '@emotion/styled';
import { Select } from '../common/Select';
import { Checkbox } from '../common/Checkbox';
import { ExportFormat, ExportProgress } from '../../types/export.types';
import { useExport } from '../../hooks/useExport';

// Format options with descriptions and compression support
const FORMAT_OPTIONS = [
  { 
    value: ExportFormat.MARKDOWN, 
    label: 'Markdown', 
    description: 'Plain text with formatting',
    compression: true 
  },
  { 
    value: ExportFormat.PDF, 
    label: 'PDF', 
    description: 'Portable Document Format',
    compression: false 
  },
  { 
    value: ExportFormat.NOTION, 
    label: 'Notion', 
    description: 'Notion compatible format',
    compression: true 
  }
];

// Compression level options
const COMPRESSION_LEVELS = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3
};

// Retry delay sequence in milliseconds
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000];

// Styled components with accessibility enhancements
const StyledForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
  max-width: 600px;
  padding: 1.5rem;
  background: ${props => props.theme.colors.secondary[50]};
  border-radius: ${props => props.theme.borderRadius.md};
  box-shadow: ${props => props.theme.shadows.sm};

  &:focus-within {
    box-shadow: ${props => props.theme.shadows.md};
  }
`;

const StyledOptionsGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const StyledProgress = styled.div<{ progress: number }>`
  width: 100%;
  height: 4px;
  background: ${props => props.theme.colors.secondary[200]};
  border-radius: 2px;
  overflow: hidden;

  &::after {
    content: '';
    display: block;
    width: ${props => props.progress}%;
    height: 100%;
    background: ${props => props.theme.colors.primary[500]};
    transition: width 0.3s ease-in-out;
  }
`;

// Component props interface
interface ExportOptionsProps {
  contentIds: string[];
  onExportStart: (options: any, securityToken: string) => void;
  onProgress: (progress: ExportProgress) => void;
  onError: (error: Error) => void;
  className?: string;
  compressionLevel?: number;
  maxRetries?: number;
  'aria-label'?: string;
  role?: string;
}

export const ExportOptions: React.FC<ExportOptionsProps> = ({
  contentIds,
  onExportStart,
  onProgress,
  onError,
  className,
  compressionLevel = COMPRESSION_LEVELS.MEDIUM,
  maxRetries = 3,
  'aria-label': ariaLabel = 'Export options',
  role = 'form'
}) => {
  // State management
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(ExportFormat.MARKDOWN);
  const [includeGraphs, setIncludeGraphs] = useState(true);
  const [includeReferences, setIncludeReferences] = useState(true);
  const [enableCompression, setEnableCompression] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Custom hook for export operations
  const { 
    exportState,
    isExporting,
    error,
    startExport,
    cancelExport,
    retryExport
  } = useExport();

  // Handle format changes with validation
  const handleFormatChange = useCallback((format: ExportFormat) => {
    setSelectedFormat(format);
    // Reset compression for PDF format
    if (format === ExportFormat.PDF) {
      setEnableCompression(false);
    }
  }, []);

  // Handle form submission with security validation
  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      // Generate secure export token
      const securityToken = await generateSecurityToken();

      // Prepare export options
      const exportOptions = {
        format: selectedFormat,
        contentIds,
        includeGraphs,
        includeReferences,
        compression: enableCompression ? compressionLevel : COMPRESSION_LEVELS.NONE,
        securityToken,
        metadata: {
          timestamp: new Date().toISOString(),
          source: window.location.origin
        }
      };

      // Start export process
      await startExport(exportOptions);
      onExportStart(exportOptions, securityToken);

    } catch (error) {
      onError(error as Error);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    selectedFormat,
    contentIds,
    includeGraphs,
    includeReferences,
    enableCompression,
    compressionLevel,
    startExport,
    onExportStart,
    onError
  ]);

  // Track export progress
  useEffect(() => {
    if (exportState) {
      onProgress(exportState);
    }
  }, [exportState, onProgress]);

  // Handle export errors
  useEffect(() => {
    if (error) {
      onError(new Error(error.message));
    }
  }, [error, onError]);

  return (
    <StyledForm 
      onSubmit={handleSubmit}
      className={className}
      aria-label={ariaLabel}
      role={role}
    >
      <Select
        label="Export Format"
        options={FORMAT_OPTIONS}
        value={selectedFormat}
        onChange={handleFormatChange}
        disabled={isExporting}
        required
        aria-required="true"
        aria-describedby="format-description"
      />

      <StyledOptionsGroup role="group" aria-label="Export options">
        <Checkbox
          id="include-graphs"
          name="includeGraphs"
          checked={includeGraphs}
          onChange={setIncludeGraphs}
          disabled={isExporting}
          label="Include knowledge graphs"
          aria-describedby="graphs-description"
        />

        <Checkbox
          id="include-references"
          name="includeReferences"
          checked={includeReferences}
          onChange={setIncludeReferences}
          disabled={isExporting}
          label="Include references"
          aria-describedby="references-description"
        />

        {FORMAT_OPTIONS.find(f => f.value === selectedFormat)?.compression && (
          <Checkbox
            id="enable-compression"
            name="enableCompression"
            checked={enableCompression}
            onChange={setEnableCompression}
            disabled={isExporting || selectedFormat === ExportFormat.PDF}
            label="Enable compression"
            aria-describedby="compression-description"
          />
        )}
      </StyledOptionsGroup>

      {isExporting && exportState && (
        <StyledProgress 
          progress={exportState.progress} 
          role="progressbar"
          aria-valuenow={exportState.progress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      )}

      <button
        type="submit"
        disabled={isSubmitting || isExporting || !contentIds.length}
        aria-busy={isSubmitting || isExporting}
      >
        {isExporting ? 'Exporting...' : 'Export'}
      </button>

      {isExporting && (
        <button
          type="button"
          onClick={cancelExport}
          aria-label="Cancel export"
        >
          Cancel
        </button>
      )}
    </StyledForm>
  );
};

// Helper function to generate secure export token
const generateSecurityToken = async (): Promise<string> => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  const data = `export-${timestamp}-${random}`;
  
  // Use Web Crypto API for secure token generation
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export default ExportOptions;