// External imports with versions
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'; // v29.x
import puppeteer, { Browser, Page } from 'puppeteer'; // v19.x
import { AxePuppeteer } from 'axe-puppeteer'; // v1.x
import 'expect-puppeteer'; // v9.x

// Internal imports
import { setupTestEnvironment, teardownTestEnvironment, createTestData } from '../../utils/test-helpers';

// Constants for test configuration
const TEST_TIMEOUT = 60000;
const BASE_URL = process.env.TEST_APP_URL || 'http://localhost:3000';
const VIEWPORT_SIZES = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 }
};
const PERFORMANCE_THRESHOLD = 5000; // 5 seconds max processing time
const QUALITY_THRESHOLD = 0.9; // 90% quality threshold

// Test suite setup
describe('Content Discovery E2E Tests', () => {
  let browser: Browser;
  let page: Page;
  let performanceMetrics: any = {};

  beforeAll(async () => {
    try {
      // Initialize test environment
      await setupTestEnvironment();

      // Launch browser with enterprise configuration
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ],
        defaultViewport: VIEWPORT_SIZES.desktop
      });

      // Create new page with error tracking
      page = await browser.newPage();
      page.on('pageerror', error => {
        console.error('Page error:', error);
      });
      page.on('console', msg => {
        if (msg.type() === 'error') {
          console.error('Console error:', msg.text());
        }
      });

      // Enable request interception for timing metrics
      await page.setRequestInterception(true);
      page.on('request', request => {
        performanceMetrics[request.url()] = { startTime: Date.now() };
        request.continue();
      });
      page.on('requestfinished', request => {
        if (performanceMetrics[request.url()]) {
          performanceMetrics[request.url()].endTime = Date.now();
          performanceMetrics[request.url()].duration = 
            performanceMetrics[request.url()].endTime - 
            performanceMetrics[request.url()].startTime;
        }
      });

      // Navigate to application
      await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
    } catch (error) {
      console.error('Setup failed:', error);
      throw error;
    }
  }, TEST_TIMEOUT);

  afterAll(async () => {
    try {
      // Save performance metrics
      console.log('Performance Metrics:', performanceMetrics);

      // Close browser and cleanup
      if (browser) {
        await browser.close();
      }
      await teardownTestEnvironment();
    } catch (error) {
      console.error('Teardown failed:', error);
      throw error;
    }
  });

  test('Search functionality returns relevant results within performance threshold', async () => {
    const startTime = Date.now();

    // Type search query with realistic timing
    await page.type('[data-testid="search-input"]', 'machine learning', { delay: 100 });
    await page.click('[data-testid="search-button"]');

    // Wait for and validate search results
    await page.waitForSelector('[data-testid="content-grid"]', { timeout: PERFORMANCE_THRESHOLD });
    const searchDuration = Date.now() - startTime;
    expect(searchDuration).toBeLessThan(PERFORMANCE_THRESHOLD);

    // Verify content quality indicators
    const qualityScores = await page.$$eval(
      '[data-testid="quality-score"]',
      elements => elements.map(el => parseFloat(el.getAttribute('data-score') || '0'))
    );
    expect(qualityScores.every(score => score >= QUALITY_THRESHOLD)).toBe(true);
  }, TEST_TIMEOUT);

  test('Content filtering applies criteria correctly', async () => {
    // Apply multiple filters
    await page.click('[data-testid="filter-button"]');
    await page.click('[data-testid="content-type-video"]');
    await page.click('[data-testid="quality-threshold-slider"]');
    await page.click('[data-testid="apply-filters"]');

    // Validate filtered results
    const contentItems = await page.$$('[data-testid="content-item"]');
    for (const item of contentItems) {
      const type = await item.$eval('[data-testid="content-type"]', el => el.textContent);
      const quality = await item.$eval('[data-testid="quality-score"]', 
        el => parseFloat(el.getAttribute('data-score') || '0'));
      
      expect(type).toBe('video');
      expect(quality).toBeGreaterThanOrEqual(QUALITY_THRESHOLD);
    }
  });

  test('Responsive layout adapts across breakpoints', async () => {
    // Test mobile layout
    await page.setViewport(VIEWPORT_SIZES.mobile);
    await page.waitForTimeout(1000); // Allow for layout changes
    let isMobileMenuVisible = await page.$eval(
      '[data-testid="mobile-menu"]',
      el => window.getComputedStyle(el).display !== 'none'
    );
    expect(isMobileMenuVisible).toBe(true);

    // Test tablet layout
    await page.setViewport(VIEWPORT_SIZES.tablet);
    await page.waitForTimeout(1000);
    let isTabletGrid = await page.$eval(
      '[data-testid="content-grid"]',
      el => window.getComputedStyle(el).gridTemplateColumns.split(' ').length === 2
    );
    expect(isTabletGrid).toBe(true);

    // Test desktop layout
    await page.setViewport(VIEWPORT_SIZES.desktop);
    await page.waitForTimeout(1000);
    let isDesktopGrid = await page.$eval(
      '[data-testid="content-grid"]',
      el => window.getComputedStyle(el).gridTemplateColumns.split(' ').length === 3
    );
    expect(isDesktopGrid).toBe(true);
  });

  test('Accessibility compliance for interactive elements', async () => {
    // Run axe accessibility tests
    const results = await new AxePuppeteer(page).analyze();
    expect(results.violations).toHaveLength(0);

    // Test keyboard navigation
    await page.keyboard.press('Tab');
    const activeElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    expect(activeElement).toBe('search-input');
  });

  test('Error handling and recovery', async () => {
    // Simulate network error
    await page.setOfflineMode(true);
    await page.click('[data-testid="search-button"]');
    
    // Verify error message
    const errorMessage = await page.$eval(
      '[data-testid="error-message"]',
      el => el.textContent
    );
    expect(errorMessage).toContain('network error');

    // Test recovery
    await page.setOfflineMode(false);
    await page.click('[data-testid="retry-button"]');
    await page.waitForSelector('[data-testid="content-grid"]');
  });

  test('Content preview functionality', async () => {
    // Open content preview
    await page.click('[data-testid="content-item"]');
    await page.waitForSelector('[data-testid="preview-modal"]');

    // Verify preview content
    const previewTitle = await page.$eval(
      '[data-testid="preview-title"]',
      el => el.textContent
    );
    expect(previewTitle).toBeTruthy();

    // Test preview interactions
    await page.click('[data-testid="preview-close"]');
    const isPreviewClosed = await page.$eval(
      '[data-testid="preview-modal"]',
      el => window.getComputedStyle(el).display === 'none'
    );
    expect(isPreviewClosed).toBe(true);
  });
});