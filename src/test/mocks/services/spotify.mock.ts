// External dependencies with versions
import { jest } from '@jest/globals';  // @jest/globals@29.x
import { v4 as uuidv4 } from 'uuid';  // uuid@9.x

// Internal dependencies
import { TestLogger } from '../../utils/test-logger';
import { Content } from '../../../backend/content-discovery/app/models/content';

// Mock configuration constants
const MOCK_ACCESS_TOKEN = 'mock-spotify-access-token';
const MOCK_TOKEN_EXPIRY = 3600;
const MOCK_RESPONSE_DELAY = 100;
const MOCK_ERROR_RATE = 0.1;
const MOCK_QUALITY_SCORE_RANGE = { min: 0.5, max: 1.0 };

// Mock podcast data templates
const MOCK_PODCAST_TEMPLATES = [
  {
    name: 'Tech Insights',
    publisher: 'TechCorp',
    language: 'en',
    episodeCount: 100,
    averageDuration: 3600
  },
  {
    name: 'Data Science Weekly',
    publisher: 'DS Network',
    language: 'en',
    episodeCount: 200,
    averageDuration: 2700
  }
];

/**
 * MockSpotifyService provides a configurable mock implementation for testing
 * the Spotify podcast content discovery functionality with realistic API behavior.
 */
export class MockSpotifyService {
  private client_id: string;
  private client_secret: string;
  private access_token: string | null;
  private token_expiry: number;
  private logger: TestLogger;
  private mockResponses: Map<string, any>;
  private responseDelay: number;
  private errorRate: number;
  private correlationId: string;

  constructor(
    responseDelay: number = MOCK_RESPONSE_DELAY,
    errorRate: number = MOCK_ERROR_RATE
  ) {
    this.client_id = 'mock-client-id';
    this.client_secret = 'mock-client-secret';
    this.access_token = null;
    this.token_expiry = 0;
    this.correlationId = uuidv4();
    this.logger = new TestLogger({ correlationId: this.correlationId });
    this.mockResponses = new Map();
    this.responseDelay = responseDelay;
    this.errorRate = errorRate;

    // Set up cleanup for test isolation
    afterEach(() => {
      this.mockResponses.clear();
      this.access_token = null;
      this.token_expiry = 0;
    });
  }

  /**
   * Simulates Spotify authentication process with configurable failure scenarios
   */
  async authenticate(): Promise<string> {
    this.correlationId = uuidv4();
    this.logger.info('Attempting mock Spotify authentication', {
      correlationId: this.correlationId
    });

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, this.responseDelay));

    // Simulate random failures
    if (Math.random() < this.errorRate) {
      const error = new Error('Mock authentication failed');
      this.logger.error('Authentication error', {
        error: error.message,
        correlationId: this.correlationId
      });
      throw error;
    }

    this.access_token = MOCK_ACCESS_TOKEN;
    this.token_expiry = Date.now() + MOCK_TOKEN_EXPIRY * 1000;

    this.logger.info('Mock authentication successful', {
      correlationId: this.correlationId
    });

    return this.access_token;
  }

  /**
   * Returns mock podcast search results with configurable quality scores
   */
  async search_podcasts(
    query: string,
    limit: number = 10,
    options: any = {}
  ): Promise<Content[]> {
    if (!query) {
      throw new Error('Search query is required');
    }

    this.logger.debug('Searching podcasts', {
      query,
      limit,
      options,
      correlationId: this.correlationId
    });

    // Check token expiration
    if (!this.access_token || Date.now() > this.token_expiry) {
      await this.authenticate();
    }

    // Check for custom mock response
    const mockKey = `search_podcasts:${query}`;
    if (this.mockResponses.has(mockKey)) {
      return this.mockResponses.get(mockKey);
    }

    // Generate mock podcast results
    const results: Content[] = [];
    for (let i = 0; i < limit; i++) {
      const template = MOCK_PODCAST_TEMPLATES[i % MOCK_PODCAST_TEMPLATES.length];
      const qualityScore = this.generateQualityScore();
      
      const content = {
        id: uuidv4(),
        type: 'podcast',
        title: `${template.name} Episode ${i + 1}`,
        description: `Mock podcast episode about ${query}`,
        source_url: `https://mock-spotify.com/episodes/${uuidv4()}`,
        quality_score: qualityScore,
        metadata: {
          duration: template.averageDuration,
          episode_number: i + 1,
          series_name: template.name,
          platform: 'Spotify',
          publisher: template.publisher,
          language: template.language
        }
      } as Content;

      results.push(content);
    }

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, this.responseDelay));

    this.logger.info('Mock podcast search completed', {
      resultCount: results.length,
      correlationId: this.correlationId
    });

    return results;
  }

  /**
   * Returns detailed mock data for a podcast episode
   */
  async get_episode_details(episode_id: string): Promise<object> {
    if (!episode_id) {
      throw new Error('Episode ID is required');
    }

    this.logger.debug('Fetching episode details', {
      episodeId: episode_id,
      correlationId: this.correlationId
    });

    // Check for custom mock response
    const mockKey = `episode_details:${episode_id}`;
    if (this.mockResponses.has(mockKey)) {
      return this.mockResponses.get(mockKey);
    }

    // Generate mock episode details
    const template = MOCK_PODCAST_TEMPLATES[0];
    const details = {
      id: episode_id,
      name: `${template.name} Episode`,
      description: 'Mock episode description with detailed content',
      duration_ms: template.averageDuration * 1000,
      release_date: new Date().toISOString(),
      language: template.language,
      explicit: false,
      type: 'episode',
      uri: `spotify:episode:${episode_id}`,
      external_urls: {
        spotify: `https://mock-spotify.com/episodes/${episode_id}`
      },
      show: {
        name: template.name,
        publisher: template.publisher,
        total_episodes: template.episodeCount
      }
    };

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, this.responseDelay));

    this.logger.info('Mock episode details retrieved', {
      episodeId: episode_id,
      correlationId: this.correlationId
    });

    return details;
  }

  /**
   * Configures custom mock responses for specific test cases
   */
  setMockResponse(operation: string, response: any): void {
    this.logger.debug('Setting custom mock response', {
      operation,
      correlationId: this.correlationId
    });
    this.mockResponses.set(operation, response);
  }

  /**
   * Generates a realistic quality score for mock content
   */
  private generateQualityScore(): number {
    const { min, max } = MOCK_QUALITY_SCORE_RANGE;
    return Number((Math.random() * (max - min) + min).toFixed(2));
  }
}