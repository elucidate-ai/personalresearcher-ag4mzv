/**
 * Content Redux Slice
 * @version 1.0.0
 * @description Redux slice for managing content-related state with comprehensive
 * content discovery, filtering, quality validation, and performance optimization.
 */

import { createSlice, createAsyncThunk, createSelector, PayloadAction } from '@reduxjs/toolkit'; // ^2.0.0
import { Content, ContentFilter, ContentType } from '../../types/content.types';
import { ContentApi } from '../../lib/api/content.api';

// Constants for content management
const QUALITY_THRESHOLD = 0.9; // 90% relevance threshold requirement
const DEFAULT_PAGE_SIZE = 20;

/**
 * Interface for pagination state management
 */
interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

/**
 * Interface for content performance metrics
 */
interface ContentMetrics {
  requestCount: number;
  errorCount: number;
  averageLoadTime: number;
  lastUpdated: string | null;
}

/**
 * Interface for the content slice state
 */
interface ContentState {
  items: Content[];
  selectedContent: Content | null;
  filters: ContentFilter;
  loading: boolean;
  error: string | null;
  pagination: PaginationState;
  lastUpdated: Date | null;
  metrics: ContentMetrics;
}

/**
 * Initial state with default values
 */
const initialState: ContentState = {
  items: [],
  selectedContent: null,
  filters: {
    types: Object.values(ContentType),
    minQualityScore: QUALITY_THRESHOLD,
    dateRange: {
      start: undefined,
      end: undefined
    },
    languages: ['en'],
    keywords: []
  },
  loading: false,
  error: null,
  pagination: {
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
    hasMore: false
  },
  lastUpdated: null,
  metrics: {
    requestCount: 0,
    errorCount: 0,
    averageLoadTime: 0,
    lastUpdated: null
  }
};

/**
 * Async thunk for fetching content by topic with quality validation
 */
export const fetchContentByTopic = createAsyncThunk(
  'content/fetchByTopic',
  async ({ 
    topicId, 
    filters 
  }: { 
    topicId: string; 
    filters: ContentFilter 
  }, { rejectWithValue }) => {
    try {
      const startTime = Date.now();
      const contentApi = new ContentApi();
      
      // Ensure minimum quality threshold
      const enhancedFilters = {
        ...filters,
        minQualityScore: Math.max(filters.minQualityScore, QUALITY_THRESHOLD)
      };

      const contents = await contentApi.getContentByTopic(topicId, enhancedFilters);
      
      return {
        contents,
        metrics: {
          loadTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch content');
    }
  }
);

/**
 * Content slice definition with reducers and actions
 */
const contentSlice = createSlice({
  name: 'content',
  initialState,
  reducers: {
    setSelectedContent: (state, action: PayloadAction<Content | null>) => {
      state.selectedContent = action.payload;
    },
    updateFilters: (state, action: PayloadAction<Partial<ContentFilter>>) => {
      state.filters = {
        ...state.filters,
        ...action.payload
      };
    },
    resetFilters: (state) => {
      state.filters = initialState.filters;
    },
    setPage: (state, action: PayloadAction<number>) => {
      state.pagination.page = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchContentByTopic.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.metrics.requestCount += 1;
      })
      .addCase(fetchContentByTopic.fulfilled, (state, action) => {
        const { contents, metrics } = action.payload;
        state.items = contents;
        state.loading = false;
        state.lastUpdated = new Date();
        state.pagination.total = contents.length;
        state.pagination.hasMore = contents.length >= state.pagination.pageSize;
        
        // Update metrics
        state.metrics.averageLoadTime = (
          (state.metrics.averageLoadTime * (state.metrics.requestCount - 1) + metrics.loadTime) / 
          state.metrics.requestCount
        );
        state.metrics.lastUpdated = metrics.timestamp;
      })
      .addCase(fetchContentByTopic.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.metrics.errorCount += 1;
      });
  }
});

// Export actions
export const {
  setSelectedContent,
  updateFilters,
  resetFilters,
  setPage,
  clearError
} = contentSlice.actions;

// Memoized selectors for optimized state access
export const selectContent = (state: { content: ContentState }) => state.content.items;

export const selectContentByType = createSelector(
  [selectContent, (_, type: ContentType) => type],
  (contents, type) => contents.filter(content => content.type === type)
);

export const selectContentByQuality = createSelector(
  [selectContent, (_, threshold: number) => threshold],
  (contents, threshold) => contents.filter(content => content.qualityScore >= threshold)
);

export const selectFilteredContent = createSelector(
  [selectContent, (state: { content: ContentState }) => state.content.filters],
  (contents, filters) => contents.filter(content => {
    return (
      filters.types.includes(content.type) &&
      content.qualityScore >= filters.minQualityScore &&
      (!filters.languages.length || filters.languages.includes(content.metadata.language)) &&
      (!filters.keywords.length || 
        filters.keywords.some(keyword => 
          content.metadata.keywords.includes(keyword)
        ))
    );
  })
);

// Export reducer
export default contentSlice.reducer;