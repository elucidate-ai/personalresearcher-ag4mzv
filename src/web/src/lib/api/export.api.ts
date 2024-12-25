/**
 * Export API Client Module
 * Version: 1.0.0
 * 
 * Provides secure, enterprise-grade API client functions for document export operations
 * with comprehensive error handling, progress tracking, monitoring, and format validation.
 */

import axios from 'axios'; // ^1.6.0
import retry from 'axios-retry'; // ^3.8.0
import { ExportFormat, ExportOptions, ExportProgress, ExportResult } from '../../types/export.types';
import { createApiRequest } from '../../utils/api.utils';
import { validateExportRequest } from '../../utils/validation.utils';
import { API_ENDPOINTS, buildApiUrl } from '../../constants/api.constants';

// Constants for export configuration
const EXPORT_TIMEOUT = 60000; // 60 seconds for export operations
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;
const PROGRESS_POLL_INTERVAL = 2000;

/**
 * Initiates a new document export process with comprehensive validation and security checks
 * @param options - Export configuration options
 * @returns Promise resolving to export ID for tracking
 */
export async function initiateExport(options: ExportOptions): Promise<string> {
  try {
    // Validate export request
    const validationResult = validateExportRequest(options);
    if (!validationResult.isValid) {
      throw new Error(`Invalid export request: ${validationResult.errors.join(', ')}`);
    }

    // Create secure API request instance
    const api = createApiRequest();
    api.defaults.timeout = EXPORT_TIMEOUT;

    // Configure retry mechanism for export requests
    retry(api, {
      retries: MAX_RETRIES,
      retryDelay: (retryCount) => retryCount * RETRY_DELAY,
      retryCondition: (error) => {
        return retry.isNetworkOrIdempotentRequestError(error) ||
          error.response?.status === 429 || // Rate limit
          error.response?.status === 503;    // Service unavailable
      }
    });

    // Send export request with security headers
    const response = await api.post(
      buildApiUrl(API_ENDPOINTS.EXPORT.GENERATE),
      options,
      {
        headers: {
          'X-Export-Format': options.format,
          'X-Content-Count': options.contentIds.length.toString()
        }
      }
    );

    return response.data.exportId;
  } catch (error) {
    console.error('[Export API] Export initiation failed:', error);
    throw error;
  }
}

/**
 * Retrieves current export progress with enhanced error handling and monitoring
 * @param exportId - ID of the export operation
 * @returns Promise resolving to detailed export progress
 */
export async function getExportProgress(exportId: string): Promise<ExportProgress> {
  try {
    const api = createApiRequest();
    
    const response = await api.get(
      buildApiUrl(API_ENDPOINTS.EXPORT.STATUS.replace(':id', exportId))
    );

    if (!response.data.exportProgress) {
      throw new Error('Invalid progress response format');
    }

    return response.data.exportProgress;
  } catch (error) {
    console.error('[Export API] Progress check failed:', error);
    throw error;
  }
}

/**
 * Retrieves export result with security validation and cleanup
 * @param exportId - ID of the export operation
 * @returns Promise resolving to secure download URL and metadata
 */
export async function getExportResult(exportId: string): Promise<ExportResult> {
  try {
    const api = createApiRequest();
    
    const response = await api.get(
      buildApiUrl(API_ENDPOINTS.EXPORT.DOWNLOAD.replace(':id', exportId)),
      {
        headers: {
          'Accept': 'application/json',
          'X-Export-Access': exportId
        },
        validateStatus: (status) => status === 200
      }
    );

    if (!response.data.exportResult) {
      throw new Error('Invalid export result format');
    }

    return response.data.exportResult;
  } catch (error) {
    console.error('[Export API] Result retrieval failed:', error);
    throw error;
  }
}

/**
 * Cancels an ongoing export operation with resource cleanup
 * @param exportId - ID of the export operation to cancel
 * @returns Promise resolving when cancellation is complete
 */
export async function cancelExport(exportId: string): Promise<void> {
  try {
    const api = createApiRequest();
    
    await api.delete(
      buildApiUrl(API_ENDPOINTS.EXPORT.STATUS.replace(':id', exportId)),
      {
        headers: {
          'X-Export-Cancel': 'true',
          'X-Export-Access': exportId
        }
      }
    );
  } catch (error) {
    console.error('[Export API] Export cancellation failed:', error);
    throw error;
  }
}

/**
 * Polls export progress until completion or failure
 * @param exportId - ID of the export operation to monitor
 * @param onProgress - Optional callback for progress updates
 * @returns Promise resolving to export result
 */
export async function waitForExportCompletion(
  exportId: string,
  onProgress?: (progress: ExportProgress) => void
): Promise<ExportResult> {
  try {
    let completed = false;
    
    while (!completed) {
      const progress = await getExportProgress(exportId);
      
      if (onProgress) {
        onProgress(progress);
      }

      if (progress.status === 'COMPLETED') {
        completed = true;
        return await getExportResult(exportId);
      }

      if (progress.status === 'FAILED') {
        throw new Error(`Export failed: ${progress.error?.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, PROGRESS_POLL_INTERVAL));
    }

    throw new Error('Export monitoring failed');
  } catch (error) {
    console.error('[Export API] Export monitoring failed:', error);
    throw error;
  }
}