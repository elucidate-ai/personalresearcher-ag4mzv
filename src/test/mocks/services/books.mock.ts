/**
 * Mock Google Books Service Implementation
 * Version: 1.0.0
 * 
 * Provides thread-safe, memory-efficient mock responses for book content discovery testing
 * with quality validation, realistic processing delays, and error simulation.
 */

// External imports with versions
import { jest } from '@jest/globals'; // v29.x
import { faker } from '@faker-js/faker'; // ^8.0.0
import { v4 as uuid } from 'uuid'; // ^9.0.0

// Internal imports
import { MockFactory } from '../../utils/mock-factory';
import { createTestLogger } from '../../utils/test-helpers';

// Constants for mock configuration
const DEFAULT_QUALITY_SCORE = 0.9;
const MOCK_RESPONSE_DELAY = 100; // milliseconds
const MAX_BATCH_SIZE = 100;
const ERROR_SIMULATION_RATE = 0.05; // 5% error rate

/**
 * Thread-safe mock implementation of Google Books service for testing
 */
export class MockGoogleBooksService {
    private mockFactory: MockFactory;
    private logger: any;
    private mockResponses: Map<string, any>;
    private processingTimes: Map<string, number>;

    constructor(
        qualityThreshold: number = DEFAULT_QUALITY_SCORE,
        processingDelay: number = MOCK_RESPONSE_DELAY
    ) {
        this.mockFactory = new MockFactory({
            qualityThreshold,
            validateSchema: true,
            monitorPerformance: true
        });
        this.logger = createTestLogger();
        this.mockResponses = new Map();
        this.processingTimes = new Map();
    }

    /**
     * Mock implementation of book search with quality validation and error simulation
     */
    async search_books(
        topic: string,
        topic_id: string,
        filters?: Record<string, any>
    ): Promise<any[]> {
        const startTime = Date.now();
        const correlationId = uuid();

        try {
            // Input validation
            if (!topic || !topic_id) {
                throw new Error('Topic and topic_id are required');
            }

            // Check for pre-configured mock response
            if (this.mockResponses.has(topic)) {
                return this.mockResponses.get(topic);
            }

            // Simulate random errors
            if (Math.random() < ERROR_SIMULATION_RATE) {
                throw new Error('Simulated API error');
            }

            // Generate mock book content
            const bookCount = Math.floor(Math.random() * 10) + 5;
            const books = [];

            for (let i = 0; i < bookCount; i++) {
                const book = await this.generateMockBook(topic_id);
                if (book.quality_score >= DEFAULT_QUALITY_SCORE) {
                    books.push(book);
                }
            }

            // Apply filters if provided
            let filteredBooks = books;
            if (filters) {
                filteredBooks = this.applyFilters(books, filters);
            }

            // Simulate API processing delay
            await new Promise(resolve => setTimeout(resolve, MOCK_RESPONSE_DELAY));

            // Track processing time
            const processingTime = Date.now() - startTime;
            this.processingTimes.set(correlationId, processingTime);

            this.logger.info('Mock books search completed', {
                correlationId,
                topic,
                resultCount: filteredBooks.length,
                processingTime
            });

            return filteredBooks;

        } catch (error) {
            this.logger.error('Mock books search failed', {
                correlationId,
                topic,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Configure mock response for specific topic
     */
    setMockResponse(topic: string, response: any, validateQuality: boolean = true): void {
        try {
            if (validateQuality) {
                response = Array.isArray(response) ? 
                    response.filter(book => book.quality_score >= DEFAULT_QUALITY_SCORE) :
                    response;
            }

            this.mockResponses.set(topic, response);
            
            this.logger.info('Mock response configured', {
                topic,
                responseSize: Array.isArray(response) ? response.length : 1
            });
        } catch (error) {
            this.logger.error('Failed to set mock response', {
                topic,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Clear all mock responses and metrics
     */
    clearMockResponses(): void {
        this.mockResponses.clear();
        this.processingTimes.clear();
        this.logger.info('Mock responses cleared');
    }

    /**
     * Get performance metrics for monitoring
     */
    getPerformanceMetrics(): Record<string, any> {
        const times = Array.from(this.processingTimes.values());
        return {
            averageProcessingTime: times.reduce((a, b) => a + b, 0) / times.length,
            maxProcessingTime: Math.max(...times),
            minProcessingTime: Math.min(...times),
            totalRequests: times.length
        };
    }

    /**
     * Generate a single mock book with metadata
     */
    private async generateMockBook(topic_id: string): Promise<any> {
        return {
            id: uuid(),
            topic_id,
            type: 'book',
            title: faker.lorem.words(3),
            description: faker.lorem.paragraph(),
            source_url: faker.internet.url(),
            quality_score: faker.number.float({ min: 0.8, max: 1.0, precision: 0.01 }),
            metadata: {
                author: faker.person.fullName(),
                isbn: faker.string.numeric(13),
                publisher: faker.company.name(),
                publication_year: faker.number.int({ min: 2000, max: 2024 }),
                page_count: faker.number.int({ min: 100, max: 1000 }),
                language: 'en',
                categories: [faker.lorem.word(), faker.lorem.word()],
                rating: faker.number.float({ min: 3.0, max: 5.0, precision: 0.1 })
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
    }

    /**
     * Apply filters to mock book results
     */
    private applyFilters(books: any[], filters: Record<string, any>): any[] {
        return books.filter(book => {
            let matches = true;
            
            if (filters.minQualityScore) {
                matches = matches && book.quality_score >= filters.minQualityScore;
            }
            
            if (filters.yearRange) {
                matches = matches && 
                    book.metadata.publication_year >= filters.yearRange.start &&
                    book.metadata.publication_year <= filters.yearRange.end;
            }
            
            if (filters.language) {
                matches = matches && book.metadata.language === filters.language;
            }

            return matches;
        });
    }
}