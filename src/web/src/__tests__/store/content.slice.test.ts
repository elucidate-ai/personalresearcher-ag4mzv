/**
 * Content Slice Test Suite
 * @version 1.0.0
 * @description Comprehensive test suite for content state management, async operations,
 * filtering, and selectors with extensive coverage of content discovery functionality.
 */

import { configureStore } from '@reduxjs/toolkit'; // ^2.0.0
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'; // ^29.0.0
import {
  contentSlice,
  reducer,
  actions,
  fetchContentByTopic,
  fetchContentById,
  selectContent,
  selectContentByType,
  selectContentByQuality,
  selectFilteredContent
} from '../../store/content/content.slice';
import { mockContent, mockContentList } from '../../../test/mocks/data/content.mock';
import { ContentApi } from '../../lib/api/content.api';
import { ContentType, ContentFilter } from '../../types/content.types';

// Mock ContentApi
jest.mock('../../lib/api/content.api');

describe('contentSlice', () => {
  let store: ReturnType<typeof configureStore>;
  let mockContentApi: jest.Mocked<ContentApi>;

  beforeEach(() => {
    // Configure test store
    store = configureStore({
      reducer: {
        content: reducer
      }
    });

    // Reset ContentApi mock
    mockContentApi = new ContentApi() as jest.Mocked<ContentApi>;
    (ContentApi as jest.Mock).mockImplementation(() => mockContentApi);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('reducer', () => {
    it('should return initial state', () => {
      const state = store.getState().content;
      expect(state.items).toEqual([]);
      expect(state.loading).toBeFalsy();
      expect(state.error).toBeNull();
    });

    it('should handle setSelectedContent', () => {
      store.dispatch(actions.setSelectedContent(mockContent));
      const state = store.getState().content;
      expect(state.selectedContent).toEqual(mockContent);
    });

    it('should handle updateFilters', () => {
      const newFilters: Partial<ContentFilter> = {
        types: [ContentType.ARTICLE],
        minQualityScore: 0.95
      };
      store.dispatch(actions.updateFilters(newFilters));
      const state = store.getState().content;
      expect(state.filters.types).toEqual(newFilters.types);
      expect(state.filters.minQualityScore).toBe(newFilters.minQualityScore);
    });

    it('should handle resetFilters', () => {
      // First update filters
      store.dispatch(actions.updateFilters({ types: [ContentType.VIDEO] }));
      // Then reset
      store.dispatch(actions.resetFilters());
      const state = store.getState().content;
      expect(state.filters.types).toEqual(Object.values(ContentType));
    });

    it('should handle setPage', () => {
      store.dispatch(actions.setPage(2));
      const state = store.getState().content;
      expect(state.pagination.page).toBe(2);
    });

    it('should handle clearError', () => {
      // First set an error through a failed action
      store.dispatch({ type: 'content/fetchByTopic/rejected', error: { message: 'Test error' } });
      // Then clear it
      store.dispatch(actions.clearError());
      const state = store.getState().content;
      expect(state.error).toBeNull();
    });
  });

  describe('async thunks', () => {
    it('should handle fetchContentByTopic.pending', () => {
      store.dispatch(fetchContentByTopic.pending('', { topicId: '123', filters: {} }));
      const state = store.getState().content;
      expect(state.loading).toBeTruthy();
      expect(state.error).toBeNull();
    });

    it('should handle fetchContentByTopic.fulfilled', async () => {
      mockContentApi.getContentByTopic.mockResolvedValue(mockContentList);
      
      await store.dispatch(fetchContentByTopic({ 
        topicId: '123', 
        filters: store.getState().content.filters 
      }));

      const state = store.getState().content;
      expect(state.items).toEqual(mockContentList);
      expect(state.loading).toBeFalsy();
      expect(state.lastUpdated).toBeDefined();
    });

    it('should handle fetchContentByTopic.rejected', async () => {
      const errorMessage = 'Failed to fetch content';
      mockContentApi.getContentByTopic.mockRejectedValue(new Error(errorMessage));

      await store.dispatch(fetchContentByTopic({ 
        topicId: '123', 
        filters: store.getState().content.filters 
      }));

      const state = store.getState().content;
      expect(state.error).toBe(errorMessage);
      expect(state.loading).toBeFalsy();
      expect(state.metrics.errorCount).toBe(1);
    });

    it('should validate quality threshold on content fetch', async () => {
      const highQualityContent = mockContentList.filter(c => c.qualityScore >= 0.9);
      mockContentApi.getContentByTopic.mockResolvedValue(highQualityContent);

      await store.dispatch(fetchContentByTopic({
        topicId: '123',
        filters: { minQualityScore: 0.9 }
      }));

      const state = store.getState().content;
      expect(state.items.every(item => item.qualityScore >= 0.9)).toBeTruthy();
    });
  });

  describe('selectors', () => {
    beforeEach(() => {
      // Populate store with mock data
      store.dispatch(fetchContentByTopic.fulfilled(
        { contents: mockContentList, metrics: { loadTime: 100, timestamp: new Date().toISOString() } },
        '',
        { topicId: '123', filters: {} }
      ));
    });

    it('should select all content', () => {
      const content = selectContent(store.getState());
      expect(content).toEqual(mockContentList);
    });

    it('should select content by type', () => {
      const videoContent = selectContentByType(store.getState(), ContentType.VIDEO);
      expect(videoContent.every(item => item.type === ContentType.VIDEO)).toBeTruthy();
    });

    it('should select content by quality threshold', () => {
      const threshold = 0.95;
      const highQualityContent = selectContentByQuality(store.getState(), threshold);
      expect(highQualityContent.every(item => item.qualityScore >= threshold)).toBeTruthy();
    });

    it('should select filtered content', () => {
      // Update filters first
      store.dispatch(actions.updateFilters({
        types: [ContentType.ARTICLE],
        minQualityScore: 0.9,
        languages: ['en']
      }));

      const filteredContent = selectFilteredContent(store.getState());
      expect(filteredContent.every(item => 
        item.type === ContentType.ARTICLE &&
        item.qualityScore >= 0.9 &&
        item.metadata.language === 'en'
      )).toBeTruthy();
    });
  });

  describe('metrics tracking', () => {
    it('should track request counts', async () => {
      mockContentApi.getContentByTopic.mockResolvedValue(mockContentList);

      await store.dispatch(fetchContentByTopic({
        topicId: '123',
        filters: store.getState().content.filters
      }));

      const state = store.getState().content;
      expect(state.metrics.requestCount).toBe(1);
    });

    it('should calculate average load time', async () => {
      mockContentApi.getContentByTopic.mockResolvedValue(mockContentList);

      await store.dispatch(fetchContentByTopic({
        topicId: '123',
        filters: store.getState().content.filters
      }));

      const state = store.getState().content;
      expect(state.metrics.averageLoadTime).toBeGreaterThan(0);
      expect(state.metrics.lastUpdated).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      mockContentApi.getContentByTopic.mockRejectedValue(new Error('Network error'));

      await store.dispatch(fetchContentByTopic({
        topicId: '123',
        filters: store.getState().content.filters
      }));

      const state = store.getState().content;
      expect(state.error).toBe('Network error');
      expect(state.metrics.errorCount).toBe(1);
    });

    it('should handle validation errors', async () => {
      mockContentApi.getContentByTopic.mockRejectedValue(new Error('Invalid topic ID'));

      await store.dispatch(fetchContentByTopic({
        topicId: '',
        filters: store.getState().content.filters
      }));

      const state = store.getState().content;
      expect(state.error).toBe('Invalid topic ID');
    });
  });
});