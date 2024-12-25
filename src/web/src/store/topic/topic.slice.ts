/**
 * Topic Redux Slice
 * @version 1.0.0
 * @description Manages topic-related state with comprehensive loading states, error handling,
 * and relationship management to support content discovery and knowledge organization.
 */

import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit'; // ^2.0.0
import { Topic, TopicFilter } from '../../types/topic.types';
import { topicApi } from '../../lib/api/topic.api';

// State interface
interface TopicState {
  topics: Topic[];
  selectedTopic: Topic | null;
  relatedTopics: Topic[];
  loading: {
    search: boolean;
    details: boolean;
    related: boolean;
  };
  error: {
    search: string | null;
    details: string | null;
    related: string | null;
  };
  lastUpdated: number;
  requestStatus: {
    retryCount: number;
    lastRetryTimestamp: number;
  };
}

// Initial state
const initialState: TopicState = {
  topics: [],
  selectedTopic: null,
  relatedTopics: [],
  loading: {
    search: false,
    details: false,
    related: false
  },
  error: {
    search: null,
    details: null,
    related: null
  },
  lastUpdated: 0,
  requestStatus: {
    retryCount: 0,
    lastRetryTimestamp: 0
  }
};

// Async thunks
export const searchTopics = createAsyncThunk(
  'topic/search',
  async (filter: TopicFilter, { rejectWithValue }) => {
    try {
      // Ensure minimum relevance score meets 90% threshold requirement
      const validatedFilter = {
        ...filter,
        minRelevanceScore: Math.max(filter.minRelevanceScore, 90)
      };

      const response = await topicApi.searchTopics(validatedFilter);
      return response.items;
    } catch (error) {
      return rejectWithValue('Failed to search topics. Please try again later.');
    }
  }
);

export const getTopicById = createAsyncThunk(
  'topic/getById',
  async (id: string, { rejectWithValue }) => {
    try {
      const topic = await topicApi.getTopic(id);
      return topic;
    } catch (error) {
      return rejectWithValue('Failed to fetch topic details. Please try again later.');
    }
  }
);

export const getRelatedTopics = createAsyncThunk(
  'topic/getRelated',
  async (id: string, { rejectWithValue }) => {
    try {
      const topics = await topicApi.getRelatedTopics(id);
      return topics;
    } catch (error) {
      return rejectWithValue('Failed to fetch related topics. Please try again later.');
    }
  }
);

// Create the slice
const topicSlice = createSlice({
  name: 'topic',
  initialState,
  reducers: {
    clearTopics: (state) => {
      state.topics = [];
      state.error.search = null;
    },
    clearSelectedTopic: (state) => {
      state.selectedTopic = null;
      state.error.details = null;
    },
    clearRelatedTopics: (state) => {
      state.relatedTopics = [];
      state.error.related = null;
    },
    resetErrors: (state) => {
      state.error = {
        search: null,
        details: null,
        related: null
      };
    }
  },
  extraReducers: (builder) => {
    // Search Topics
    builder
      .addCase(searchTopics.pending, (state) => {
        state.loading.search = true;
        state.error.search = null;
      })
      .addCase(searchTopics.fulfilled, (state, action) => {
        state.topics = action.payload;
        state.loading.search = false;
        state.lastUpdated = Date.now();
        state.requestStatus.retryCount = 0;
      })
      .addCase(searchTopics.rejected, (state, action) => {
        state.loading.search = false;
        state.error.search = action.payload as string;
        state.requestStatus.retryCount += 1;
        state.requestStatus.lastRetryTimestamp = Date.now();
      })

    // Get Topic by ID
    builder
      .addCase(getTopicById.pending, (state) => {
        state.loading.details = true;
        state.error.details = null;
      })
      .addCase(getTopicById.fulfilled, (state, action) => {
        state.selectedTopic = action.payload;
        state.loading.details = false;
        state.lastUpdated = Date.now();
        state.requestStatus.retryCount = 0;
      })
      .addCase(getTopicById.rejected, (state, action) => {
        state.loading.details = false;
        state.error.details = action.payload as string;
        state.requestStatus.retryCount += 1;
        state.requestStatus.lastRetryTimestamp = Date.now();
      })

    // Get Related Topics
    builder
      .addCase(getRelatedTopics.pending, (state) => {
        state.loading.related = true;
        state.error.related = null;
      })
      .addCase(getRelatedTopics.fulfilled, (state, action) => {
        state.relatedTopics = action.payload;
        state.loading.related = false;
        state.lastUpdated = Date.now();
        state.requestStatus.retryCount = 0;
      })
      .addCase(getRelatedTopics.rejected, (state, action) => {
        state.loading.related = false;
        state.error.related = action.payload as string;
        state.requestStatus.retryCount += 1;
        state.requestStatus.lastRetryTimestamp = Date.now();
      });
  }
});

// Selectors
export const selectTopics = createSelector(
  [(state: { topic: TopicState }) => state.topic],
  (topic) => topic.topics
);

export const selectSelectedTopic = createSelector(
  [(state: { topic: TopicState }) => state.topic],
  (topic) => topic.selectedTopic
);

export const selectRelatedTopics = createSelector(
  [(state: { topic: TopicState }) => state.topic],
  (topic) => topic.relatedTopics
);

export const selectLoadingStates = createSelector(
  [(state: { topic: TopicState }) => state.topic],
  (topic) => topic.loading
);

export const selectErrors = createSelector(
  [(state: { topic: TopicState }) => state.topic],
  (topic) => topic.error
);

export const selectRequestStatus = createSelector(
  [(state: { topic: TopicState }) => state.topic],
  (topic) => topic.requestStatus
);

// Export actions and reducer
export const { clearTopics, clearSelectedTopic, clearRelatedTopics, resetErrors } = topicSlice.actions;
export default topicSlice.reducer;