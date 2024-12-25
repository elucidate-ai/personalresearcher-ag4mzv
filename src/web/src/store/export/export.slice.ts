/**
 * Export Redux Slice
 * Version: 1.0.0
 * 
 * Manages document export state with enhanced security, progress tracking,
 * error handling, and cleanup mechanisms. Implements requirements for
 * multimedia document creation and multiple export format support.
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { 
  ExportFormat, 
  ExportOptions, 
  ExportProgress, 
  ExportStatus,
  ExportError,
  ExportErrorCode,
  ExportResult,
  ExportStage,
  isExportProgress,
  isExportResult
} from '../../types/export.types';

// Constants for export configuration
const EXPORT_TIMEOUT_MS = 300000; // 5 minutes
const MAX_RETRIES = 3;
const CLEANUP_INTERVAL_MS = 3600000; // 1 hour
const PROGRESS_POLL_INTERVAL = 2000; // 2 seconds

// Interface for export state
interface ExportState {
  currentExportId: string | null;
  progress: ExportProgress | null;
  result: ExportResult | null;
  error: ExportError | null;
  isLoading: boolean;
  retryCount: number;
  lastActivity: string | null;
  stage: ExportStage | null;
}

// Initial state with proper typing
const initialState: ExportState = {
  currentExportId: null,
  progress: null,
  result: null,
  error: null,
  isLoading: false,
  retryCount: 0,
  lastActivity: null,
  stage: null
};

/**
 * Async thunk for initiating export with security validation and rate limiting
 */
export const startExport = createAsyncThunk<string, ExportOptions>(
  'export/startExport',
  async (options: ExportOptions, { rejectWithValue, dispatch }) => {
    try {
      // Validate export options
      if (!options.format || !options.contentIds.length) {
        throw new Error('Invalid export options');
      }

      // Security validation
      if (!options.securityToken) {
        throw new Error('Security token required');
      }

      // Rate limiting check
      const lastExport = localStorage.getItem('lastExportTime');
      if (lastExport && Date.now() - parseInt(lastExport) < 60000) {
        throw new Error('Rate limit exceeded');
      }

      // Start export process
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${options.securityToken}`
        },
        body: JSON.stringify(options)
      });

      if (!response.ok) {
        throw new Error('Export initiation failed');
      }

      const data = await response.json();
      if (!data.exportId) {
        throw new Error('Invalid export response');
      }

      // Update last export time
      localStorage.setItem('lastExportTime', Date.now().toString());

      // Start progress polling
      dispatch(pollExportProgress(data.exportId));

      return data.exportId;
    } catch (error) {
      return rejectWithValue({
        code: ExportErrorCode.PROCESSING_ERROR,
        message: error instanceof Error ? error.message : 'Export failed',
        details: {}
      });
    }
  }
);

/**
 * Async thunk for checking export progress with enhanced error handling
 */
export const checkExportProgress = createAsyncThunk<ExportProgress, string>(
  'export/checkProgress',
  async (exportId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/export/${exportId}/progress`);
      if (!response.ok) {
        throw new Error('Failed to fetch export progress');
      }

      const data = await response.json();
      if (!isExportProgress(data)) {
        throw new Error('Invalid progress data');
      }

      return data;
    } catch (error) {
      return rejectWithValue({
        code: ExportErrorCode.PROCESSING_ERROR,
        message: error instanceof Error ? error.message : 'Progress check failed',
        details: {}
      });
    }
  }
);

/**
 * Helper thunk for polling export progress
 */
const pollExportProgress = createAsyncThunk(
  'export/pollProgress',
  async (exportId: string, { dispatch, getState }) => {
    const poll = async () => {
      const state = getState() as { export: ExportState };
      
      if (state.export.error || 
          state.export.progress?.status === ExportStatus.COMPLETED ||
          state.export.progress?.status === ExportStatus.FAILED) {
        return;
      }

      await dispatch(checkExportProgress(exportId));
      setTimeout(() => poll(), PROGRESS_POLL_INTERVAL);
    };

    await poll();
  }
);

/**
 * Export slice with enhanced features and security
 */
const exportSlice = createSlice({
  name: 'export',
  initialState,
  reducers: {
    resetExport: (state) => {
      return { ...initialState };
    },
    clearError: (state) => {
      state.error = null;
    },
    updateLastActivity: (state) => {
      state.lastActivity = new Date().toISOString();
    },
    cleanup: (state) => {
      if (state.lastActivity) {
        const lastActivityTime = new Date(state.lastActivity).getTime();
        if (Date.now() - lastActivityTime > CLEANUP_INTERVAL_MS) {
          return { ...initialState };
        }
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Start Export
      .addCase(startExport.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.retryCount = 0;
      })
      .addCase(startExport.fulfilled, (state, action) => {
        state.currentExportId = action.payload;
        state.isLoading = false;
        state.lastActivity = new Date().toISOString();
      })
      .addCase(startExport.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as ExportError;
        state.lastActivity = new Date().toISOString();
      })
      // Check Progress
      .addCase(checkExportProgress.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(checkExportProgress.fulfilled, (state, action) => {
        state.progress = action.payload;
        state.isLoading = false;
        state.lastActivity = new Date().toISOString();
        
        if (action.payload.status === ExportStatus.FAILED && 
            state.retryCount < MAX_RETRIES) {
          state.retryCount += 1;
        }
      })
      .addCase(checkExportProgress.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as ExportError;
        state.lastActivity = new Date().toISOString();
      });
  }
});

// Export actions and reducer
export const { resetExport, clearError, updateLastActivity, cleanup } = exportSlice.actions;
export default exportSlice.reducer;

// Selectors
export const selectExportState = (state: { export: ExportState }) => state.export;
export const selectExportProgress = (state: { export: ExportState }) => state.export.progress;
export const selectExportError = (state: { export: ExportState }) => state.export.error;
export const selectIsExporting = (state: { export: ExportState }) => state.export.isLoading;