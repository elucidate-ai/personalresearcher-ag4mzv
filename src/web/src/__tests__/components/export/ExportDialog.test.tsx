import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { vi, describe, it, beforeEach, afterEach } from 'vitest';
import ExportDialog from '../../../components/export/ExportDialog';
import { ExportFormat, ExportStatus } from '../../../types/export.types';

// Mock the useExport hook
const mockUseExport = vi.fn(() => ({
  exportState: {
    status: 'idle',
    progress: 0,
    stage: '',
    error: null
  },
  isExporting: false,
  error: null,
  startExport: vi.fn(),
  downloadExport: vi.fn(),
  cancelExport: vi.fn(),
  retryExport: vi.fn()
}));

vi.mock('../../../hooks/useExport', () => ({
  useExport: () => mockUseExport()
}));

// Mock store setup
const mockStore = {
  getState: () => ({
    export: {
      status: 'idle',
      progress: 0,
      stage: '',
      error: null,
      formats: ['notion', 'markdown', 'pdf']
    }
  }),
  subscribe: vi.fn(),
  dispatch: vi.fn()
};

describe('ExportDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    contentIds: ['content-1', 'content-2'],
    securityToken: 'test-token',
    maxExportSize: 10485760, // 10MB
    onError: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should render export format options correctly', () => {
    render(
      <Provider store={mockStore}>
        <ExportDialog {...defaultProps} />
      </Provider>
    );

    // Verify format selection is present
    expect(screen.getByRole('combobox', { name: /export format/i })).toBeInTheDocument();

    // Verify all format options are available
    const formatSelect = screen.getByRole('combobox', { name: /export format/i });
    const options = within(formatSelect).getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent(/markdown/i);
    expect(options[1]).toHaveTextContent(/pdf/i);
    expect(options[2]).toHaveTextContent(/notion/i);
  });

  it('should handle export configuration options', async () => {
    const mockStartExport = vi.fn();
    mockUseExport.mockImplementation(() => ({
      ...mockUseExport(),
      startExport: mockStartExport
    }));

    render(
      <Provider store={mockStore}>
        <ExportDialog {...defaultProps} />
      </Provider>
    );

    // Select export format
    const formatSelect = screen.getByRole('combobox', { name: /export format/i });
    fireEvent.change(formatSelect, { target: { value: ExportFormat.MARKDOWN } });

    // Configure export options
    const includeGraphsCheckbox = screen.getByRole('checkbox', { name: /include graphs/i });
    const includeReferencesCheckbox = screen.getByRole('checkbox', { name: /include references/i });

    fireEvent.click(includeGraphsCheckbox);
    fireEvent.click(includeReferencesCheckbox);

    // Start export
    const exportButton = screen.getByRole('button', { name: /export/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(mockStartExport).toHaveBeenCalledWith(expect.objectContaining({
        format: ExportFormat.MARKDOWN,
        contentIds: defaultProps.contentIds,
        includeGraphs: true,
        includeReferences: true,
        securityToken: defaultProps.securityToken
      }));
    });
  });

  it('should track export progress correctly', async () => {
    const progressStates = [
      { status: ExportStatus.PROCESSING, progress: 25, stage: 'Collecting content' },
      { status: ExportStatus.PROCESSING, progress: 50, stage: 'Generating document' },
      { status: ExportStatus.PROCESSING, progress: 75, stage: 'Finalizing' },
      { status: ExportStatus.COMPLETED, progress: 100, stage: 'Complete' }
    ];

    let currentState = 0;
    mockUseExport.mockImplementation(() => ({
      ...mockUseExport(),
      exportState: progressStates[currentState],
      isExporting: currentState < 3
    }));

    render(
      <Provider store={mockStore}>
        <ExportDialog {...defaultProps} />
      </Provider>
    );

    // Verify initial progress state
    expect(screen.getByText(/collecting content/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');

    // Simulate progress updates
    for (let i = 1; i < progressStates.length; i++) {
      currentState = i;
      await waitFor(() => {
        expect(screen.getByText(progressStates[i].stage)).toBeInTheDocument();
        expect(screen.getByRole('progressbar')).toHaveAttribute(
          'aria-valuenow',
          progressStates[i].progress.toString()
        );
      });
    }
  });

  it('should handle error scenarios appropriately', async () => {
    const mockError = {
      message: 'Export failed due to network error',
      code: 'NETWORK_ERROR'
    };

    mockUseExport.mockImplementation(() => ({
      ...mockUseExport(),
      error: mockError,
      isExporting: false
    }));

    render(
      <Provider store={mockStore}>
        <ExportDialog {...defaultProps} />
      </Provider>
    );

    // Verify error message is displayed
    expect(screen.getByText(mockError.message)).toBeInTheDocument();

    // Verify retry button is available
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();

    // Test retry functionality
    fireEvent.click(retryButton);
    expect(mockUseExport().retryExport).toHaveBeenCalled();
  });

  it('should validate export size limits', async () => {
    const largeContentIds = Array(1000).fill('content-id');
    
    render(
      <Provider store={mockStore}>
        <ExportDialog {...defaultProps} contentIds={largeContentIds} />
      </Provider>
    );

    const exportButton = screen.getByRole('button', { name: /export/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText(/exceeds maximum export size/i)).toBeInTheDocument();
      expect(defaultProps.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('maximum export size')
        })
      );
    });
  });

  it('should handle export cancellation', async () => {
    mockUseExport.mockImplementation(() => ({
      ...mockUseExport(),
      isExporting: true,
      exportState: {
        status: ExportStatus.PROCESSING,
        progress: 50,
        stage: 'Processing'
      }
    }));

    render(
      <Provider store={mockStore}>
        <ExportDialog {...defaultProps} />
      </Provider>
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(mockUseExport().cancelExport).toHaveBeenCalled();
  });
});