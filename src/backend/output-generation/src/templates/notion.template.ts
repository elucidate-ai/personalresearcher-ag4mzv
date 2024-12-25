/**
 * @fileoverview Notion template implementation for document content conversion
 * Handles conversion of document content to Notion-compatible blocks with
 * advanced error handling, caching, and performance optimization
 * @version 1.0.0
 */

import { BlockObjectRequest } from '@notionhq/client'; // ^2.0.0
import { DocumentContent, DocumentSection } from '../models/document.model';

/**
 * Represents a Notion block structure with extended properties
 */
interface NotionBlock {
    type: string;
    properties: Record<string, any>;
    children?: NotionBlock[];
}

/**
 * Rate limiter configuration for Notion API calls
 */
interface RateLimiter {
    maxRequests: number;
    interval: number;
    currentRequests: number;
    lastReset: Date;
}

/**
 * Template class for converting document content to Notion format
 * with advanced features including caching and rate limiting
 */
export class NotionTemplate {
    private blockTypes: Map<string, Function>;
    private cache: Map<string, BlockObjectRequest[]>;
    private rateLimiter: RateLimiter;
    private readonly MAX_BLOCK_CHILDREN = 100;
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    constructor() {
        this.initializeBlockTypes();
        this.initializeCache();
        this.initializeRateLimiter();
    }

    /**
     * Converts document content to Notion blocks with optimization and error handling
     * @param document The document content to convert
     * @returns Promise resolving to array of Notion blocks
     */
    public async convertToNotion(document: DocumentContent): Promise<BlockObjectRequest[]> {
        try {
            // Check cache first
            const cacheKey = this.generateCacheKey(document);
            const cachedResult = this.getFromCache(cacheKey);
            if (cachedResult) {
                return cachedResult;
            }

            // Create title block
            const blocks: BlockObjectRequest[] = [{
                object: 'block',
                type: 'heading_1',
                heading_1: {
                    rich_text: [{
                        type: 'text',
                        text: { content: document.metadata.title }
                    }]
                }
            }];

            // Add metadata block
            blocks.push(this.createMetadataBlock(document.metadata));

            // Process sections
            for (const section of document.sections) {
                const sectionBlocks = await this.convertSection(section, 1);
                blocks.push(...sectionBlocks);
            }

            // Validate and optimize blocks
            const validatedBlocks = this.validateBlocks(blocks);
            
            // Cache the result
            this.addToCache(cacheKey, validatedBlocks);

            return validatedBlocks;
        } catch (error) {
            console.error('Error converting document to Notion format:', error);
            throw new Error('Failed to convert document to Notion format');
        }
    }

    /**
     * Converts a document section to Notion blocks with nested handling
     * @param section The section to convert
     * @param depth Current depth level
     * @returns Array of Notion blocks
     */
    private async convertSection(section: DocumentSection, depth: number): Promise<BlockObjectRequest[]> {
        const blocks: BlockObjectRequest[] = [];

        // Create heading block based on depth
        const headingType = `heading_${Math.min(depth, 3)}` as const;
        blocks.push({
            object: 'block',
            type: headingType,
            [headingType]: {
                rich_text: [{
                    type: 'text',
                    text: { content: section.title }
                }]
            }
        });

        // Parse section content
        const contentBlocks = await this.parseContent(section.content);
        blocks.push(...contentBlocks);

        // Process subsections recursively
        if (section.subsections && section.subsections.length > 0) {
            for (const subsection of section.subsections) {
                const subsectionBlocks = await this.convertSection(subsection, depth + 1);
                blocks.push(...subsectionBlocks);
            }
        }

        return blocks;
    }

    /**
     * Parses markdown content into Notion blocks with enhanced formatting
     * @param content Markdown content to parse
     * @returns Array of parsed Notion blocks
     */
    private async parseContent(content: string): Promise<BlockObjectRequest[]> {
        const blocks: BlockObjectRequest[] = [];
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Check for code blocks
            if (line.startsWith('```')) {
                const codeBlocks = this.handleCodeBlock(lines, i);
                blocks.push(...codeBlocks.blocks);
                i = codeBlocks.newIndex;
                continue;
            }

            // Handle different block types
            if (line.startsWith('- ')) {
                blocks.push(this.createBulletedListBlock(line.slice(2)));
            } else if (line.startsWith('1. ')) {
                blocks.push(this.createNumberedListBlock(line.slice(3)));
            } else if (line.startsWith('> ')) {
                blocks.push(this.createQuoteBlock(line.slice(2)));
            } else {
                blocks.push(this.createParagraphBlock(line));
            }
        }

        return blocks;
    }

    /**
     * Initializes block type converters
     */
    private initializeBlockTypes(): void {
        this.blockTypes = new Map();
        this.blockTypes.set('paragraph', this.createParagraphBlock.bind(this));
        this.blockTypes.set('bullet_list', this.createBulletedListBlock.bind(this));
        this.blockTypes.set('numbered_list', this.createNumberedListBlock.bind(this));
        this.blockTypes.set('quote', this.createQuoteBlock.bind(this));
        this.blockTypes.set('code', this.createCodeBlock.bind(this));
    }

    /**
     * Initializes caching mechanism
     */
    private initializeCache(): void {
        this.cache = new Map();
        setInterval(() => this.cleanCache(), this.CACHE_TTL);
    }

    /**
     * Initializes rate limiter
     */
    private initializeRateLimiter(): void {
        this.rateLimiter = {
            maxRequests: 3,
            interval: 1000,
            currentRequests: 0,
            lastReset: new Date()
        };
    }

    /**
     * Creates a metadata block for document information
     */
    private createMetadataBlock(metadata: any): BlockObjectRequest {
        return {
            object: 'block',
            type: 'callout',
            callout: {
                rich_text: [{
                    type: 'text',
                    text: {
                        content: `Created: ${metadata.createdAt.toLocaleDateString()}\nAuthor: ${metadata.author}\nTags: ${metadata.tags.join(', ')}`
                    }
                }],
                icon: { emoji: 'ℹ️' }
            }
        };
    }

    /**
     * Creates a paragraph block
     */
    private createParagraphBlock(content: string): BlockObjectRequest {
        return {
            object: 'block',
            type: 'paragraph',
            paragraph: {
                rich_text: [{
                    type: 'text',
                    text: { content }
                }]
            }
        };
    }

    /**
     * Creates a bulleted list block
     */
    private createBulletedListBlock(content: string): BlockObjectRequest {
        return {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
                rich_text: [{
                    type: 'text',
                    text: { content }
                }]
            }
        };
    }

    /**
     * Creates a numbered list block
     */
    private createNumberedListBlock(content: string): BlockObjectRequest {
        return {
            object: 'block',
            type: 'numbered_list_item',
            numbered_list_item: {
                rich_text: [{
                    type: 'text',
                    text: { content }
                }]
            }
        };
    }

    /**
     * Creates a quote block
     */
    private createQuoteBlock(content: string): BlockObjectRequest {
        return {
            object: 'block',
            type: 'quote',
            quote: {
                rich_text: [{
                    type: 'text',
                    text: { content }
                }]
            }
        };
    }

    /**
     * Handles code block parsing
     */
    private handleCodeBlock(lines: string[], startIndex: number): { blocks: BlockObjectRequest[], newIndex: number } {
        let language = lines[startIndex].slice(3).trim();
        let code = '';
        let i = startIndex + 1;

        while (i < lines.length && !lines[i].startsWith('```')) {
            code += lines[i] + '\n';
            i++;
        }

        return {
            blocks: [{
                object: 'block',
                type: 'code',
                code: {
                    rich_text: [{
                        type: 'text',
                        text: { content: code.trim() }
                    }],
                    language: language || 'plain text'
                }
            }],
            newIndex: i
        };
    }

    /**
     * Validates and optimizes blocks
     */
    private validateBlocks(blocks: BlockObjectRequest[]): BlockObjectRequest[] {
        return blocks.filter(block => {
            if (!block.type || !block[block.type]) {
                console.warn('Invalid block structure detected, removing:', block);
                return false;
            }
            return true;
        });
    }

    /**
     * Cache management methods
     */
    private generateCacheKey(document: DocumentContent): string {
        return `${document.metadata.id}-${document.metadata.version}`;
    }

    private getFromCache(key: string): BlockObjectRequest[] | null {
        const cached = this.cache.get(key);
        return cached || null;
    }

    private addToCache(key: string, blocks: BlockObjectRequest[]): void {
        this.cache.set(key, blocks);
    }

    private cleanCache(): void {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value[0].created_time > this.CACHE_TTL) {
                this.cache.delete(key);
            }
        }
    }
}