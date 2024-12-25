/**
 * YouTube Service Mock Implementation
 * Version: 1.0.0
 * 
 * Provides mock implementation of YouTube service for testing with enhanced
 * quality scoring, error simulation, and type safety. Supports content discovery
 * engine requirements for video content aggregation and quality assessment.
 */

import { generateMockContent } from '../data/content.mock';
import { 
  Content, 
  ContentType, 
  MIN_QUALITY_THRESHOLD 
} from '../../../web/src/types/content.types';

// Mock configuration constants
const MOCK_VIDEO_QUALITY_THRESHOLD = 0.90; // 90% relevance threshold requirement
const MOCK_MAX_RESULTS = 10;
const MOCK_API_LATENCY_MS = 200;
const MOCK_ERROR_RATE = 0.05; // 5% simulated error rate

/**
 * Enhanced mock implementation of YouTubeService for testing
 * with quality scoring and error simulation
 */
export class MockYouTubeService {
  private _mockVideos: Content[];
  private _searchMock: jest.Mock;
  private _detailsMock: jest.Mock;
  private _qualityScores: Map<string, number>;
  private _timestamps: Map<string, Date>;

  constructor() {
    // Initialize mock videos with proper type checking
    this._mockVideos = Array.from({ length: 20 }, () => 
      generateMockContent(ContentType.VIDEO, 
        Math.random() * (1 - MIN_QUALITY_THRESHOLD) + MIN_QUALITY_THRESHOLD
      )
    );

    // Initialize quality scores map
    this._qualityScores = new Map(
      this._mockVideos.map(video => [video.id, video.qualityScore])
    );

    // Initialize timestamps for content freshness
    this._timestamps = new Map(
      this._mockVideos.map(video => [video.id, new Date(video.createdAt)])
    );

    // Set up search mock with error simulation
    this._searchMock = jest.fn().mockImplementation(async (query: string) => {
      // Simulate random API errors
      if (Math.random() < MOCK_ERROR_RATE) {
        throw new Error('YouTube API Error: Search failed');
      }
      return this._mockVideos.filter(video => 
        video.title.toLowerCase().includes(query.toLowerCase()) ||
        video.description.toLowerCase().includes(query.toLowerCase())
      );
    });

    // Set up video details mock with quality validation
    this._detailsMock = jest.fn().mockImplementation(async (videoId: string) => {
      const video = this._mockVideos.find(v => v.id === videoId);
      if (!video) {
        throw new Error(`Video not found: ${videoId}`);
      }
      return video;
    });
  }

  /**
   * Mock implementation of video search with quality filtering
   * @param topic_id - Topic identifier for content association
   * @param query - Search query string
   * @param max_results - Maximum number of results to return
   * @returns Promise<Array<Content>> - Filtered list of video content
   */
  async search_videos(
    topic_id: string,
    query: string,
    max_results: number = MOCK_MAX_RESULTS
  ): Promise<Array<Content>> {
    // Input validation
    if (!topic_id || !query) {
      throw new Error('Invalid search parameters');
    }

    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, MOCK_API_LATENCY_MS));

    try {
      // Get mock search results
      const searchResults = await this._searchMock(query);

      // Filter by quality threshold and sort by score
      const filteredResults = searchResults
        .filter(video => video.qualityScore >= MOCK_VIDEO_QUALITY_THRESHOLD)
        .sort((a, b) => b.qualityScore - a.qualityScore)
        .slice(0, max_results);

      // Update topic association
      return filteredResults.map(video => ({
        ...video,
        topicId: topic_id
      }));
    } catch (error) {
      throw new Error(`Failed to search videos: ${error.message}`);
    }
  }

  /**
   * Mock implementation of video details fetching with enhanced metadata
   * @param video_id - Video identifier
   * @returns Promise<Content> - Enhanced video content with quality metrics
   */
  async get_video_details(video_id: string): Promise<Content> {
    // Input validation
    if (!video_id) {
      throw new Error('Invalid video ID');
    }

    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, MOCK_API_LATENCY_MS));

    try {
      // Get mock video details
      const video = await this._detailsMock(video_id);

      // Enhance with quality metrics
      return {
        ...video,
        analysisResults: {
          ...video.analysisResults,
          qualityMetrics: {
            ...video.analysisResults.qualityMetrics,
            freshness: this._calculateFreshness(video_id)
          }
        }
      };
    } catch (error) {
      throw new Error(`Failed to get video details: ${error.message}`);
    }
  }

  /**
   * Calculate content freshness based on timestamp
   * @param video_id - Video identifier
   * @returns number - Freshness score between 0 and 1
   */
  private _calculateFreshness(video_id: string): number {
    const timestamp = this._timestamps.get(video_id);
    if (!timestamp) return 0;

    const age = Date.now() - timestamp.getTime();
    const maxAge = 180 * 24 * 60 * 60 * 1000; // 180 days in milliseconds
    return Math.max(0, 1 - (age / maxAge));
  }

  /**
   * Resets all mock functions and data
   * Useful for cleaning up between tests
   */
  reset_mocks(): void {
    this._searchMock.mockClear();
    this._detailsMock.mockClear();
    this._qualityScores.clear();
    this._timestamps.clear();
    
    // Regenerate mock videos
    this._mockVideos = Array.from({ length: 20 }, () => 
      generateMockContent(ContentType.VIDEO, 
        Math.random() * (1 - MIN_QUALITY_THRESHOLD) + MIN_QUALITY_THRESHOLD
      )
    );
  }
}

// Mock the YouTube service for testing
jest.mock('../../backend/content-discovery/app/services/youtube_service', () => {
  return {
    YouTubeService: MockYouTubeService
  };
});