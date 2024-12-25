/**
 * @fileoverview Enhanced mock implementation of the Notion service for testing
 * with improved type safety, error handling, and memory management
 * @version 1.0.0
 */

import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { Document } from '../../../backend/output-generation/src/models/document.model';
import { logger } from '../../utils/test-logger';

// Types for mock Notion data structures
interface NotionPage {
    id: string;
    title: string;
    workspaceId: string;
    createdAt: Date;
    updatedAt: Date;
}

interface NotionBlock {
    id: string;
    type: 'paragraph' | 'heading_1' | 'heading_2' | 'heading_3' | 'bulleted_list_item' | 'numbered_list_item';
    content: string;
    children?: NotionBlock[];
}

// Constants
const MOCK_PAGE_TITLE = 'Test Document';
const MOCK_WORKSPACE_ID = 'test-workspace-id';
const CLEANUP_INTERVAL = 3600000; // 1 hour in milliseconds

/**
 * Enhanced mock implementation of NotionService for testing with improved
 * type safety and error handling
 */
export class MockNotionService {
    private _mockPages: Map<string, NotionPage>;
    private _mockBlocks: Map<string, NotionBlock[]>;
    private _exportError: Error | null;
    private _lastCleanup: number;

    constructor() {
        this._mockPages = new Map<string, NotionPage>();
        this._mockBlocks = new Map<string, NotionBlock[]>();
        this._exportError = null;
        this._lastCleanup = Date.now();
    }

    /**
     * Mock implementation of document export to Notion with enhanced error handling
     * @param document - Document to export
     * @param correlationId - Correlation ID for request tracking
     * @returns Promise resolving to mock Notion page ID
     * @throws Error if export is configured to fail or validation fails
     */
    public async exportDocument(document: Document, correlationId: string): Promise<string> {
        logger.info(`Attempting to export document to Notion`, { correlationId });

        // Check for configured export error
        if (this._exportError) {
            logger.error(`Export error triggered`, { 
                correlationId, 
                error: this._exportError.message 
            });
            throw this._exportError;
        }

        // Validate document
        const validationResult = document.validate();
        if (!validationResult.isValid) {
            const error = new Error(`Document validation failed: ${validationResult.errors[0]?.message}`);
            logger.error(`Document validation failed`, { 
                correlationId, 
                errors: validationResult.errors 
            });
            throw error;
        }

        try {
            // Generate mock page ID
            const pageId = uuidv4();
            const content = document.getContent();

            // Create mock page
            const mockPage: NotionPage = {
                id: pageId,
                title: content.metadata.title || MOCK_PAGE_TITLE,
                workspaceId: MOCK_WORKSPACE_ID,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Convert document sections to Notion blocks
            const mockBlocks: NotionBlock[] = this.convertSectionsToBlocks(content.sections);

            // Store mock data
            this._mockPages.set(pageId, mockPage);
            this._mockBlocks.set(pageId, mockBlocks);

            // Perform cleanup if needed
            this.cleanup();

            logger.info(`Successfully exported document to Notion`, { 
                correlationId, 
                pageId 
            });

            return pageId;

        } catch (error) {
            logger.error(`Failed to export document to Notion`, { 
                correlationId, 
                error: error instanceof Error ? error.message : 'Unknown error' 
            });
            throw error;
        }
    }

    /**
     * Retrieves stored mock page data with input validation
     * @param pageId - ID of the mock page to retrieve
     * @returns Mock page data if found
     */
    public getMockPage(pageId: string): NotionPage | undefined {
        if (!pageId) {
            throw new Error('Page ID is required');
        }
        return this._mockPages.get(pageId);
    }

    /**
     * Retrieves stored mock blocks for a page with input validation
     * @param pageId - ID of the page to retrieve blocks for
     * @returns Array of mock blocks if found
     */
    public getMockBlocks(pageId: string): NotionBlock[] | undefined {
        if (!pageId) {
            throw new Error('Page ID is required');
        }
        return this._mockBlocks.get(pageId);
    }

    /**
     * Configures service to simulate export error with validation
     * @param error - Error to throw on next export attempt
     */
    public setExportError(error: Error): void {
        if (!(error instanceof Error)) {
            throw new Error('Invalid error object provided');
        }
        this._exportError = error;
    }

    /**
     * Resets all mock data and error state with cleanup
     */
    public reset(): void {
        this._mockPages.clear();
        this._mockBlocks.clear();
        this._exportError = null;
        this._lastCleanup = Date.now();
        logger.info('Mock Notion service reset');
    }

    /**
     * Performs periodic cleanup of mock data to prevent memory leaks
     */
    private cleanup(): void {
        const now = Date.now();
        if (now - this._lastCleanup >= CLEANUP_INTERVAL) {
            // Remove mock data older than cleanup interval
            const cutoffTime = new Date(now - CLEANUP_INTERVAL);
            
            for (const [pageId, page] of this._mockPages.entries()) {
                if (page.createdAt < cutoffTime) {
                    this._mockPages.delete(pageId);
                    this._mockBlocks.delete(pageId);
                }
            }

            this._lastCleanup = now;
            logger.info('Performed mock data cleanup');
        }
    }

    /**
     * Converts document sections to Notion block format
     * @param sections - Document sections to convert
     * @returns Array of Notion blocks
     */
    private convertSectionsToBlocks(sections: Document['getContent']['sections']): NotionBlock[] {
        const blocks: NotionBlock[] = [];

        const processSection = (section: typeof sections[0], level = 1): void => {
            // Add section title as heading
            blocks.push({
                id: uuidv4(),
                type: `heading_${Math.min(level, 3)}` as NotionBlock['type'],
                content: section.title
            });

            // Add section content as paragraph
            if (section.content) {
                blocks.push({
                    id: uuidv4(),
                    type: 'paragraph',
                    content: section.content
                });
            }

            // Process subsections recursively
            section.subsections?.forEach(subsection => {
                processSection(subsection, level + 1);
            });
        };

        sections.forEach(section => processSection(section));
        return blocks;
    }
}