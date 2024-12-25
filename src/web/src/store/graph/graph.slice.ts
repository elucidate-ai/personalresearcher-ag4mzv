/**
 * Knowledge Graph Redux Slice
 * @version 1.0.0
 * @description Manages knowledge graph state with enhanced security, validation, and performance monitoring
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // ^2.0.0
import { persistReducer } from 'redux-persist'; // ^6.0.0
import { IGraphData, NodeType, RelationshipType } from '../../types/graph.types';
import graphApi from '../../lib/api/graph.api';
import { sanitizeInput } from '../../utils/validation.utils';

// Enums for graph view modes and validation states
export enum GraphViewMode {
  DEFAULT = 'DEFAULT',
  HIERARCHICAL = 'HIERARCHICAL',
  RADIAL = 'RADIAL',
  FORCE_DIRECTED = 'FORCE_DIRECTED'
}

export enum ValidationStatus {
  PENDING = 'PENDING',
  VALID = 'VALID',
  INVALID = 'INVALID'
}

// Interfaces for enhanced state management
interface InteractionHistoryItem {
  timestamp: number;
  action: string;
  nodeId?: string;
  viewMode?: GraphViewMode;
}

interface GraphPerformanceMetrics {
  lastRenderTime: number;
  nodeCount: number;
  relationshipCount: number;
  frameRate?: number;
}

interface GraphValidationState {
  status: ValidationStatus;
  lastValidated: number;
  errors: string[];
}

// Enhanced graph state interface
interface GraphState {
  data: IGraphData | null;
  loading: boolean;
  error: string | null;
  selectedNodeId: string | null;
  zoomLevel: number;
  viewMode: GraphViewMode;
  lastUpdated: number;
  interactionHistory: InteractionHistoryItem[];
  performanceMetrics: GraphPerformanceMetrics;
  validationState: GraphValidationState;
}

// Initial state with comprehensive defaults
const initialState: GraphState = {
  data: null,
  loading: false,
  error: null,
  selectedNodeId: null,
  zoomLevel: 1,
  viewMode: GraphViewMode.DEFAULT,
  lastUpdated: 0,
  interactionHistory: [],
  performanceMetrics: {
    lastRenderTime: 0,
    nodeCount: 0,
    relationshipCount: 0
  },
  validationState: {
    status: ValidationStatus.PENDING,
    lastValidated: 0,
    errors: []
  }
};

// Enhanced async thunk for graph generation with security validation
export const generateGraphThunk = createAsyncThunk(
  'graph/generate',
  async (params: { topicId: string; options?: any }, { rejectWithValue }) => {
    try {
      const sanitizedTopicId = sanitizeInput(params.topicId);
      const response = await graphApi.generateGraph(sanitizedTopicId, params.options);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

// Enhanced async thunk for graph updates with validation
export const updateGraphThunk = createAsyncThunk(
  'graph/update',
  async (params: { graphId: string; updates: Partial<IGraphData> }, { rejectWithValue }) => {
    try {
      const sanitizedGraphId = sanitizeInput(params.graphId);
      const response = await graphApi.updateGraph(sanitizedGraphId, params.updates);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

// Create the graph slice with comprehensive state management
const graphSlice = createSlice({
  name: 'graph',
  initialState,
  reducers: {
    setSelectedNode: (state, action: PayloadAction<string | null>) => {
      state.selectedNodeId = action.payload;
      state.interactionHistory.push({
        timestamp: Date.now(),
        action: 'SELECT_NODE',
        nodeId: action.payload || undefined
      });
    },
    setZoomLevel: (state, action: PayloadAction<number>) => {
      state.zoomLevel = Math.max(0.1, Math.min(2, action.payload));
      state.interactionHistory.push({
        timestamp: Date.now(),
        action: 'ZOOM'
      });
    },
    setViewMode: (state, action: PayloadAction<GraphViewMode>) => {
      state.viewMode = action.payload;
      state.interactionHistory.push({
        timestamp: Date.now(),
        action: 'CHANGE_VIEW',
        viewMode: action.payload
      });
    },
    updatePerformanceMetrics: (state, action: PayloadAction<Partial<GraphPerformanceMetrics>>) => {
      state.performanceMetrics = {
        ...state.performanceMetrics,
        ...action.payload
      };
    },
    updateValidationState: (state, action: PayloadAction<Partial<GraphValidationState>>) => {
      state.validationState = {
        ...state.validationState,
        ...action.payload
      };
    },
    resetGraph: (state) => {
      return {
        ...initialState,
        interactionHistory: [{
          timestamp: Date.now(),
          action: 'RESET'
        }]
      };
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(generateGraphThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(generateGraphThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
        state.lastUpdated = Date.now();
        state.performanceMetrics = {
          ...state.performanceMetrics,
          nodeCount: action.payload.nodes.length,
          relationshipCount: action.payload.relationships.length
        };
        state.validationState = {
          status: ValidationStatus.VALID,
          lastValidated: Date.now(),
          errors: []
        };
      })
      .addCase(generateGraphThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.validationState = {
          status: ValidationStatus.INVALID,
          lastValidated: Date.now(),
          errors: [action.payload as string]
        };
      })
      .addCase(updateGraphThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateGraphThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
        state.lastUpdated = Date.now();
        state.performanceMetrics = {
          ...state.performanceMetrics,
          nodeCount: action.payload.nodes.length,
          relationshipCount: action.payload.relationships.length
        };
      })
      .addCase(updateGraphThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

// Export actions and reducer
export const {
  setSelectedNode,
  setZoomLevel,
  setViewMode,
  updatePerformanceMetrics,
  updateValidationState,
  resetGraph
} = graphSlice.actions;

// Configure persistence
const persistConfig = {
  key: 'graph',
  storage: localStorage,
  whitelist: ['viewMode', 'zoomLevel']
};

// Export the persisted reducer
export default persistReducer(persistConfig, graphSlice.reducer);

// Type-safe selector for graph state
export const selectGraphState = (state: { graph: GraphState }) => state.graph;