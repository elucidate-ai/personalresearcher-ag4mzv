import { Client as NotionClient } from '@notionhq/client'; // ^2.0.0
import pLimit from 'p-limit'; // ^4.0.0
import { notion as notionConfig, validateConfig } from '../config/config';
import { Document, DocumentContent } from '../models/document.model';
import { logger } from '../utils/logger';

// Constants for rate limiting and API interaction
const BLOCK_CHUNK_SIZE = 100;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const API_TIMEOUT = 30000;
const MAX_BLOCKS_PER_REQUEST = 1000;

// Interface for Notion block structure
interface NotionBlock {
    type: string;
    object: 'block';
    content: any;
    metadata?: {
        correlationId?: string;
        retryCount?: number;
        timestamp?: number;
    };
}

// Metrics collector for monitoring
interface MetricsCollector {
    startTime: number;
    blockCount: number;
    retryCount: number;
    errors: Error[];
}

/**
 * Service responsible for secure and efficient document exports to Notion
 * with comprehensive error handling and monitoring
 */
export class NotionService {
    private _client: NotionClient;
    private _rateLimiter: ReturnType<typeof pLimit>;
    private _workspaceId: string;
    private _metrics: MetricsCollector;

    constructor() {
        // Validate configuration
        validateConfig({ notion: notionConfig });

        // Initialize Notion client with secure configuration
        this._client = new NotionClient({
            auth: notionConfig.apiKey,
            timeoutMs: notionConfig.timeout,
        });

        // Configure rate limiter
        this._rateLimiter = pLimit(5); // Concurrent requests limit

        // Set workspace ID
        this._workspaceId = notionConfig.workspaceId;

        // Initialize metrics collector
        this._metrics = {
            startTime: 0,
            blockCount: 0,
            retryCount: 0,
            errors: [],
        };

        // Validate workspace access
        this.validateWorkspaceAccess().catch(error => {
            logger.error('Failed to validate Notion workspace access', { error });
            throw error;
        });
    }

    /**
     * Exports a document to Notion with enhanced security and monitoring
     * @param document Document to export
     * @param correlationId Unique identifier for request tracking
     * @returns Promise resolving to the created Notion page ID
     */
    public async exportDocument(document: Document, correlationId: string): Promise<string> {
        try {
            // Start performance tracking
            this._metrics.startTime = Date.now();
            logger.info('Starting Notion export', { correlationId });

            // Validate and sanitize document
            const validationResult = document.validate();
            if (!validationResult.isValid) {
                throw new Error(`Document validation failed: ${JSON.stringify(validationResult.errors)}`);
            }

            // Get sanitized content
            const content = document.getContent();

            // Convert content to Notion blocks
            const blocks = await this.convertToNotionBlocks(content);

            // Create parent page
            const page = await this._rateLimiter(() => this._client.pages.create({
                parent: { workspace: true },
                properties: {
                    title: {
                        title: [{ text: { content: content.metadata.title } }]
                    }
                }
            }));

            // Add content blocks with rate limiting and retries
            await this.addContentBlocks(page.id, blocks);

            // Log completion metrics
            const duration = Date.now() - this._metrics.startTime;
            logger.info('Notion export completed', {
                correlationId,
                duration,
                blockCount: this._metrics.blockCount,
                retryCount: this._metrics.retryCount,
            });

            return page.id;

        } catch (error) {
            // Enhanced error handling
            this._metrics.errors.push(error as Error);
            logger.error('Notion export failed', {
                correlationId,
                error,
                metrics: this._metrics,
            });
            throw error;
        }
    }

    /**
     * Converts document content to Notion block format with security measures
     */
    private async convertToNotionBlocks(content: DocumentContent): Promise<NotionBlock[]> {
        const blocks: NotionBlock[] = [];

        // Process sections recursively
        const processSection = (section: typeof content.sections[0]) => {
            // Add section heading
            blocks.push({
                type: 'heading_1',
                object: 'block',
                content: {
                    rich_text: [{ text: { content: section.title } }]
                }
            });

            // Add section content
            if (section.content) {
                blocks.push({
                    type: 'paragraph',
                    object: 'block',
                    content: {
                        rich_text: [{ text: { content: section.content } }]
                    }
                });
            }

            // Process subsections
            section.subsections?.forEach(processSection);
        };

        // Process all sections
        content.sections.forEach(processSection);

        // Add graphs as images
        content.graphs.forEach(graph => {
            blocks.push({
                type: 'image',
                object: 'block',
                content: {
                    caption: [{ text: { content: graph.metadata.layout } }],
                    type: 'external',
                    external: { url: `data:image/svg+xml,${encodeURIComponent(graph.id)}` }
                }
            });
        });

        // Add references
        content.references.forEach(ref => {
            blocks.push({
                type: 'bookmark',
                object: 'block',
                content: {
                    url: ref.url,
                    caption: [{ text: { content: ref.title } }]
                }
            });
        });

        return blocks;
    }

    /**
     * Adds content blocks to Notion page with rate limiting and error handling
     */
    private async addContentBlocks(pageId: string, blocks: NotionBlock[]): Promise<void> {
        // Split blocks into chunks for rate limiting
        const chunks = [];
        for (let i = 0; i < blocks.length; i += BLOCK_CHUNK_SIZE) {
            chunks.push(blocks.slice(i, i + BLOCK_CHUNK_SIZE));
        }

        // Process chunks with rate limiting
        await Promise.all(chunks.map(chunk => 
            this._rateLimiter(async () => {
                let retryCount = 0;
                while (retryCount < MAX_RETRIES) {
                    try {
                        await this._client.blocks.children.append({
                            block_id: pageId,
                            children: chunk
                        });
                        this._metrics.blockCount += chunk.length;
                        break;
                    } catch (error) {
                        retryCount++;
                        this._metrics.retryCount++;
                        if (retryCount === MAX_RETRIES) throw error;
                        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retryCount));
                    }
                }
            })
        ));
    }

    /**
     * Validates workspace access on service initialization
     */
    private async validateWorkspaceAccess(): Promise<void> {
        try {
            await this._client.users.me();
        } catch (error) {
            throw new Error('Failed to validate Notion workspace access');
        }
    }
}