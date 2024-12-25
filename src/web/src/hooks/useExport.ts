/**
 * Enhanced Export Management Hook
 * @version 1.0.0
 * @description React hook for managing document export operations with comprehensive
 * error handling, progress tracking, and security features.
 */

import { useCallback, useState, useEffect } from 'react'; // ^18.0.0
import { useAppDispatch, useAppSelector } from '../store/store';
import {
  selectExportState,
  startExport,
  downloadDocument,
  resetExport,
  clearError,
  updateLastActivity,
  cleanup
} from '../store/export/export.slice';
import {
  ExportFormat,
  ExportOptions,
  ExportProgress,
  ExportStatus,
  ExportError,
  ExportErrorCode,
  ExportResult
} from '../types/export.types';

// Constants for export operations
const EXPORT_TIMEOUT = 300000; // 5 minutes
const CLEANUP_INTERVAL = 3600000; // 1 hour
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

/**
 * Custom hook for managing document export operations
 * @returns Object containing export state and control functions
 */
export function useExport() {
  const dispatch = useAppDispatch();
  const exportState = useAppSelector(selectExportState);
  const [retryCount, setRetryCount] = useState(0);
  const [exportTimeout, setExportTimeout] = useState<NodeJS.Timeout | null>(null);

  /**
   * Initiates export process with validation and security checks
   */
  const initiateExport = useCallback(async (
    topicId: string,
    options: ExportOptions
  ): Promise<void> => {
    try {
      // Validate export options
      if (!options.format || !options.contentIds.length) {
        throw new Error('Invalid export options');
      }

      // Clear any existing export state
      dispatch(resetExport());
      setRetryCount(0);

      // Start export process
      await dispatch(startExport(options)).unwrap();

      // Set export timeout
      const timeout = setTimeout(() => {
        handleExportTimeout();
      }, EXPORT_TIMEOUT);
      setExportTimeout(timeout);

      // Update activity timestamp
      dispatch(updateLastActivity());

    } catch (error) {
      handleExportError(error);
    }
  }, [dispatch]);

  /**
   * Downloads exported document with retry mechanism
   */
  const downloadExport = useCallback(async (
    exportId: string
  ): Promise<void> => {
    try {
      await dispatch(downloadDocument(exportId)).unwrap();
      dispatch(updateLastActivity());
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        setRetryCount(prev => prev + 1);
        setTimeout(() => downloadExport(exportId), RETRY_DELAY * (retryCount + 1));
      } else {
        handleExportError(error);
      }
    }
  }, [dispatch, retryCount]);

  /**
   * Retries failed export operation
   */
  const retryExport = useCallback(async (): Promise<void> => {
    if (exportState.currentExportId && retryCount < MAX_RETRIES) {
      setRetryCount(prev => prev + 1);
      await initiateExport(
        exportState.currentExportId,
        exportState.progress?.stages[0]?.name || ''
      );
    }
  }, [exportState.currentExportId, exportState.progress, retryCount, initiateExport]);

  /**
   * Cancels ongoing export operation
   */
  const cancelExport = useCallback((): void => {
    if (exportTimeout) {
      clearTimeout(exportTimeout);
      setExportTimeout(null);
    }
    dispatch(resetExport());
    setRetryCount(0);
  }, [dispatch, exportTimeout]);

  /**
   * Handles export timeout
   */
  const handleExportTimeout = useCallback((): void => {
    dispatch(resetExport());
    handleExportError({
      code: ExportErrorCode.TIMEOUT_ERROR,
      message: 'Export operation timed out',
      details: {}
    });
  }, [dispatch]);

  /**
   * Handles export errors with proper typing
   */
  const handleExportError = useCallback((error: unknown): void => {
    const exportError: ExportError = {
      code: ExportErrorCode.PROCESSING_ERROR,
      message: error instanceof Error ? error.message : 'Export failed',
      details: { error }
    };
    console.error('Export Error:', exportError);
  }, []);

  /**
   * Cleanup effect for export resources
   */
  useEffect(() => {
    const cleanup = setInterval(() => {
      dispatch(cleanup());
    }, CLEANUP_INTERVAL);

    return () => {
      clearInterval(cleanup);
      if (exportTimeout) {
        clearTimeout(exportTimeout);
      }
    };
  }, [dispatch, exportTimeout]);

  return {
    exportState: exportState.progress,
    isExporting: exportState.isLoading,
    error: exportState.error,
    startExport: initiateExport,
    downloadExport,
    resetExport: () => dispatch(resetExport()),
    cancelExport,
    retryExport
  };
}

// Export type-safe hook
export default useExport;