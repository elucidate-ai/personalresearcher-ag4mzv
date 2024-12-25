import { expect } from '@jest/globals'; // v29.0.0
import { Page } from '@playwright/test'; // v1.39.0
import { setupTestEnvironment, validateTestResults } from '../../utils/test-helpers';
import { TestClient } from '../../utils/test-client';
import { generateMockExport } from '../../utils/data-generators';
import { ExportFormat } from '../../../web/src/types/export.types';

describe('Export Generation E2E Tests', () => {
  let testClient: TestClient;
  let page: Page;

  beforeAll(async () => {
    // Initialize test environment with monitoring
    testClient = new TestClient({
      monitorPerformance: true,
      retryConfig: {
        maxRetries: 3,
        delay: 1000
      }
    });

    // Setup test environment and mock data
    await setupTestEnvironment({
      mockData: true,
      preserveState: false
    });

    // Generate mock topic with content
    const mockTopic = await generateMockExport({
      contentCount: 5,
      includeGraphs: true,
      qualityThreshold: 0.9
    });

    // Navigate to export page
    await page.goto('/export');
  });

  afterAll(async () => {
    await testClient.cleanup();
  });

  describe('Export Dialog Tests', () => {
    test('should render export dialog with all required elements', async () => {
      // Open export dialog
      await page.click('[data-testid="export-button"]');

      // Verify dialog title and content
      expect(await page.isVisible('[data-testid="export-dialog"]')).toBe(true);
      expect(await page.textContent('[data-testid="dialog-title"]')).toBe('Export Content');

      // Verify format selection options
      const formatOptions = await page.$$('[data-testid="format-option"]');
      expect(formatOptions.length).toBe(Object.keys(ExportFormat).length);

      // Verify export button state
      expect(await page.isEnabled('[data-testid="start-export-button"]')).toBe(false);

      // Verify accessibility
      const accessibilityReport = await page.accessibility.snapshot();
      expect(accessibilityReport.violations).toHaveLength(0);
    });

    test('should validate format selection and options', async () => {
      // Select each format and verify specific options
      for (const format of Object.values(ExportFormat)) {
        await page.click(`[data-testid="format-${format.toLowerCase()}"]`);

        // Verify format-specific options are displayed
        const formatOptions = await page.isVisible(`[data-testid="${format.toLowerCase()}-options"]`);
        expect(formatOptions).toBe(true);

        // Verify format-specific validation
        switch (format) {
          case ExportFormat.MARKDOWN:
            expect(await page.isVisible('[data-testid="markdown-flavor"]')).toBe(true);
            expect(await page.isVisible('[data-testid="include-toc"]')).toBe(true);
            break;

          case ExportFormat.PDF:
            expect(await page.isVisible('[data-testid="page-size"]')).toBe(true);
            expect(await page.isVisible('[data-testid="orientation"]')).toBe(true);
            break;

          case ExportFormat.NOTION:
            expect(await page.isVisible('[data-testid="notion-database-id"]')).toBe(true);
            expect(await page.isVisible('[data-testid="create-index"]')).toBe(true);
            break;
        }
      }
    });
  });

  describe('Export Progress Tests', () => {
    test('should track export progress accurately', async () => {
      const startTime = Date.now();

      // Configure export options
      await page.click('[data-testid="format-markdown"]');
      await page.click('[data-testid="include-graphs"]');
      await page.click('[data-testid="include-references"]');

      // Start export
      await page.click('[data-testid="start-export-button"]');

      // Verify progress updates
      const progressBar = page.locator('[data-testid="progress-bar"]');
      await expect(progressBar).toBeVisible();

      // Monitor progress stages
      const stages = ['Preparing', 'Generating', 'Formatting', 'Finalizing'];
      for (const stage of stages) {
        await expect(page.locator(`[data-testid="stage-${stage}"]`)).toBeVisible();
      }

      // Verify progress completion
      await expect(progressBar).toHaveAttribute('aria-valuenow', '100');
      
      // Verify performance requirements
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // 5 seconds max per content item
    });

    test('should handle export errors gracefully', async () => {
      // Force error condition
      await page.evaluate(() => {
        window.localStorage.setItem('mock-export-error', 'true');
      });

      // Start export
      await page.click('[data-testid="start-export-button"]');

      // Verify error display
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="retry-button"]')).toBeEnabled();

      // Verify error details
      const errorDetails = await page.textContent('[data-testid="error-details"]');
      expect(errorDetails).toContain('Export failed');

      // Test retry functionality
      await page.click('[data-testid="retry-button"]');
      await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible();
    });
  });

  describe('Export Download Tests', () => {
    test('should complete download successfully', async () => {
      // Configure and start export
      await page.click('[data-testid="format-markdown"]');
      await page.click('[data-testid="start-export-button"]');

      // Wait for export completion
      await expect(page.locator('[data-testid="download-button"]')).toBeEnabled();

      // Verify download functionality
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="download-button"]');
      const download = await downloadPromise;

      // Verify downloaded file
      expect(download.suggestedFilename()).toMatch(/\.md$/);
      
      // Verify file contents (basic check)
      const downloadPath = await download.path();
      expect(downloadPath).toBeTruthy();
    });

    test('should validate export file integrity', async () => {
      // Start export with all content types
      await page.click('[data-testid="format-pdf"]');
      await page.click('[data-testid="include-all-content"]');
      await page.click('[data-testid="start-export-button"]');

      // Wait for completion
      await expect(page.locator('[data-testid="download-button"]')).toBeEnabled();

      // Download and verify file
      const download = await page.waitForEvent('download');
      await page.click('[data-testid="download-button"]');

      // Verify file metadata
      const fileInfo = await download.path();
      expect(fileInfo).toBeTruthy();

      // Verify file size is reasonable
      const stats = await fs.stat(fileInfo);
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.size).toBeLessThan(10 * 1024 * 1024); // 10MB max
    });
  });
});