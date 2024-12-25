import React, { useMemo } from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.2
import LoadingSpinner from '../common/LoadingSpinner';
import { useExport } from '../../hooks/useExport';
import { ExportStatus } from '../../types/export.types';

/**
 * Props interface for the ExportProgress component
 */
interface ExportProgressProps {
  /** Additional CSS classes to apply */
  className?: string;
  /** Custom aria label for accessibility */
  ariaLabel?: string;
}

/**
 * Returns human-readable text for export status with stage information
 * @param status - Current export status
 * @param stage - Current export stage name
 * @returns Formatted status text
 */
const getStatusText = (status: ExportStatus, stage: string): string => {
  switch (status) {
    case ExportStatus.QUEUED:
      return 'Preparing export...';
    case ExportStatus.PROCESSING:
      return `Processing: ${stage}`;
    case ExportStatus.COMPLETED:
      return 'Export completed successfully';
    case ExportStatus.FAILED:
      return 'Export failed. Please try again.';
    case ExportStatus.CANCELED:
      return 'Export was canceled';
    default:
      return 'Initializing export...';
  }
};

/**
 * Formats elapsed time since export started
 * @param startTime - Export start timestamp
 * @returns Formatted elapsed time string
 */
const formatElapsedTime = (startTime: string): string => {
  const elapsed = Date.now() - new Date(startTime).getTime();
  const seconds = Math.floor(elapsed / 1000);
  
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

/**
 * Calculates estimated time remaining based on progress
 * @param progress - Current progress percentage
 * @param startTime - Export start timestamp
 * @returns Estimated time remaining string
 */
const calculateEstimatedTime = (progress: number, startTime: string): string => {
  if (progress <= 0) return 'Calculating...';
  
  const elapsed = Date.now() - new Date(startTime).getTime();
  const estimated = (elapsed / progress) * (100 - progress);
  const seconds = Math.floor(estimated / 1000);
  
  if (seconds < 60) {
    return `~${seconds}s remaining`;
  }
  
  const minutes = Math.floor(seconds / 60);
  return `~${minutes}m remaining`;
};

/**
 * ExportProgress component displays comprehensive export progress with visual feedback
 * and accessibility features.
 */
const ExportProgress: React.FC<ExportProgressProps> = ({
  className,
  ariaLabel = 'Export progress'
}) => {
  const { exportState, isExporting, retryExport, cancelExport } = useExport();

  // Memoized calculations for performance
  const currentStage = useMemo(() => {
    return exportState?.stages[exportState.stages.length - 1]?.name || '';
  }, [exportState?.stages]);

  const statusText = useMemo(() => {
    if (!exportState) return '';
    return getStatusText(exportState.status, currentStage);
  }, [exportState, currentStage]);

  const progress = useMemo(() => {
    return exportState?.progress || 0;
  }, [exportState?.progress]);

  if (!exportState) {
    return null;
  }

  return (
    <div
      className={classNames(
        'w-full max-w-lg rounded-lg bg-white p-4 shadow-sm',
        'dark:bg-gray-800',
        className
      )}
      role="region"
      aria-label={ariaLabel}
    >
      {/* Status header */}
      <div className="flex items-center gap-4 mb-4">
        {isExporting && (
          <LoadingSpinner
            size="medium"
            color="primary"
            className="text-primary"
          />
        )}
        <div className="flex-1">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {statusText}
          </h4>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2 dark:bg-gray-700">
        <div
          className={classNames(
            'h-2.5 rounded-full transition-all duration-300',
            {
              'bg-primary': exportState.status === ExportStatus.PROCESSING,
              'bg-green-500': exportState.status === ExportStatus.COMPLETED,
              'bg-red-500': exportState.status === ExportStatus.FAILED
            }
          )}
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      {/* Time tracking */}
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>
          Elapsed: {formatElapsedTime(exportState.startedAt)}
        </span>
        {exportState.status === ExportStatus.PROCESSING && (
          <span>
            {calculateEstimatedTime(progress, exportState.startedAt)}
          </span>
        )}
      </div>

      {/* Action buttons */}
      {(exportState.status === ExportStatus.FAILED ||
        exportState.status === ExportStatus.PROCESSING) && (
        <div className="flex gap-2 mt-4">
          {exportState.status === ExportStatus.FAILED && (
            <button
              onClick={retryExport}
              className="px-3 py-1 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Retry
            </button>
          )}
          {exportState.status === ExportStatus.PROCESSING && (
            <button
              onClick={cancelExport}
              className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:text-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ExportProgress;