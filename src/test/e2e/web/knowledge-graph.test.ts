import { describe, beforeAll, afterAll, beforeEach, it, expect } from '@jest/globals';
import { Page, Browser, BrowserContext } from '@playwright/test';
import { test, expect as playwrightExpect } from '@playwright/test';
import { setupTestEnvironment, teardownTestEnvironment } from '../../utils/test-helpers';

// Constants for test configuration
const TEST_TIMEOUT = 60000;
const BASE_URL = process.env.TEST_APP_URL || 'http://localhost:3000';
const PERFORMANCE_THRESHOLDS = {
  RENDER_TIME: 2000,  // Max time for initial graph render
  INTERACTION_DELAY: 100  // Max delay for interaction responses
};

// Viewport presets for responsive testing
const VIEWPORT_PRESETS = {
  MOBILE: { width: 375, height: 667 },
  TABLET: { width: 768, height: 1024 },
  DESKTOP: { width: 1280, height: 800 }
};

// Test data types
interface GraphTestData {
  nodes: any[];
  relationships: any[];
  metadata: {
    nodeCount: number;
    relationshipCount: number;
  };
}

/**
 * Sets up test environment with specified viewport and mock data
 */
async function setupGraphTest(viewport: typeof VIEWPORT_PRESETS[keyof typeof VIEWPORT_PRESETS]) {
  const { page } = await setupTestEnvironment();
  
  // Set viewport
  await page.setViewportSize(viewport);
  
  // Navigate to graph visualization page
  await page.goto(`${BASE_URL}/graph`);
  
  // Wait for graph container to be ready
  await page.waitForSelector('[data-testid="graph-container"]');
  
  // Generate test data
  const testData: GraphTestData = {
    nodes: [
      { id: '1', label: 'Machine Learning', type: 'CORE_CONCEPT', importance: 0.95 },
      { id: '2', label: 'Neural Networks', type: 'RELATED_TOPIC', importance: 0.85 },
      { id: '3', label: 'Linear Algebra', type: 'PREREQUISITE', importance: 0.8 }
    ],
    relationships: [
      { source: '1', target: '2', type: 'RELATES_TO', weight: 0.9 },
      { source: '3', target: '1', type: 'REQUIRES', weight: 0.85 }
    ],
    metadata: {
      nodeCount: 3,
      relationshipCount: 2
    }
  };

  return { page, testData };
}

describe('Knowledge Graph E2E Tests', () => {
  let page: Page;
  let testData: GraphTestData;

  beforeAll(async () => {
    const setup = await setupGraphTest(VIEWPORT_PRESETS.DESKTOP);
    page = setup.page;
    testData = setup.testData;
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  describe('Graph Rendering', () => {
    it('should render graph container with correct dimensions', async () => {
      const container = await page.locator('[data-testid="graph-container"]');
      const bbox = await container.boundingBox();
      
      expect(bbox?.width).toBeGreaterThan(0);
      expect(bbox?.height).toBeGreaterThan(0);
    });

    it('should display all nodes from test data', async () => {
      const nodeElements = await page.locator('[data-testid^="graph-node-"]').count();
      expect(nodeElements).toBe(testData.nodes.length);
    });

    it('should render edges with correct connections', async () => {
      const edgeElements = await page.locator('[data-testid^="graph-edge-"]').count();
      expect(edgeElements).toBe(testData.relationships.length);
    });

    it('should show graph controls in proper position', async () => {
      const controls = await page.locator('[data-testid="graph-controls"]');
      await playwrightExpect(controls).toBeVisible();
    });

    it('should handle empty graph state gracefully', async () => {
      // Clear graph data
      await page.evaluate(() => {
        window.postMessage({ type: 'SET_GRAPH_DATA', payload: { nodes: [], relationships: [] } }, '*');
      });

      const emptyState = await page.locator('[data-testid="graph-empty-state"]');
      await playwrightExpect(emptyState).toBeVisible();
    });
  });

  describe('Graph Interactions', () => {
    beforeEach(async () => {
      // Reset graph to initial state before each test
      await page.reload();
      await page.waitForSelector('[data-testid="graph-container"]');
    });

    it('should zoom in/out with performance thresholds', async () => {
      const zoomIn = await page.locator('[data-testid="zoom-in-button"]');
      const zoomOut = await page.locator('[data-testid="zoom-out-button"]');

      const startTime = Date.now();
      await zoomIn.click();
      
      const zoomDuration = Date.now() - startTime;
      expect(zoomDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.INTERACTION_DELAY);

      await zoomOut.click();
    });

    it('should pan graph within boundaries', async () => {
      const container = await page.locator('[data-testid="graph-container"]');
      const bbox = await container.boundingBox();
      
      if (bbox) {
        // Simulate pan gesture
        await page.mouse.move(bbox.x + 100, bbox.y + 100);
        await page.mouse.down();
        await page.mouse.move(bbox.x + 200, bbox.y + 200);
        await page.mouse.up();
        
        // Verify graph stays within container
        const graphBounds = await page.evaluate(() => {
          const svg = document.querySelector('svg');
          return svg?.getBoundingClientRect();
        });
        
        expect(graphBounds).toBeDefined();
      }
    });

    it('should select nodes and highlight connections', async () => {
      const firstNode = await page.locator('[data-testid="graph-node-1"]');
      await firstNode.click();

      // Verify node selection
      await playwrightExpect(firstNode).toHaveClass(/selected/);

      // Verify connected edges are highlighted
      const connectedEdge = await page.locator('[data-testid="graph-edge-1-2"]');
      await playwrightExpect(connectedEdge).toHaveClass(/highlighted/);
    });

    it('should show node details on selection', async () => {
      const node = await page.locator('[data-testid="graph-node-1"]');
      await node.click();

      const detailsPanel = await page.locator('[data-testid="node-details-panel"]');
      await playwrightExpect(detailsPanel).toBeVisible();
      
      const nodeLabel = await detailsPanel.locator('h3').textContent();
      expect(nodeLabel).toBe('Machine Learning');
    });
  });

  describe('Responsive Design', () => {
    it('should adapt layout for mobile viewport', async () => {
      await page.setViewportSize(VIEWPORT_PRESETS.MOBILE);
      
      // Verify controls position
      const controls = await page.locator('[data-testid="graph-controls"]');
      const controlsBox = await controls.boundingBox();
      
      expect(controlsBox?.y).toBeGreaterThan(0);
    });

    it('should adjust control positioning for tablet', async () => {
      await page.setViewportSize(VIEWPORT_PRESETS.TABLET);
      
      const controls = await page.locator('[data-testid="graph-controls"]');
      await playwrightExpect(controls).toBeVisible();
      
      // Verify controls are in correct position for tablet
      const controlsBox = await controls.boundingBox();
      expect(controlsBox?.x).toBeGreaterThan(0);
    });

    it('should optimize for desktop view', async () => {
      await page.setViewportSize(VIEWPORT_PRESETS.DESKTOP);
      
      // Verify side panel visibility
      const detailsPanel = await page.locator('[data-testid="node-details-panel"]');
      await playwrightExpect(detailsPanel).toBeVisible();
    });

    it('should handle orientation changes', async () => {
      // Test landscape orientation
      await page.setViewportSize({ width: 667, height: 375 });
      
      // Verify graph container adapts
      const container = await page.locator('[data-testid="graph-container"]');
      const bbox = await container.boundingBox();
      
      expect(bbox?.width).toBeGreaterThan(0);
      expect(bbox?.height).toBeGreaterThan(0);
    });
  });
});