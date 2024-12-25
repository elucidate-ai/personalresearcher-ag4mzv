/**
 * Knowledge Graph API Client
 * @version 1.0.0
 * @description Comprehensive API client for interacting with the knowledge graph service
 * with enhanced security, monitoring, and error handling capabilities
 */

import axios from 'axios'; // ^1.6.0
import retry from 'axios-retry'; // ^3.8.0
import { IGraphData, IGraphNode, IGraphRelationship } from '../../types/graph.types';
import { ApiResponse } from '../../types/api.types';
import { API_ENDPOINTS } from '../../constants/api.constants';
import { createApiRequest } from '../../utils/api.utils';
import { validateUrl, sanitizeInput } from '../../utils/validation.utils';

// Constants for graph operations
const GRAPH_OPERATION_TIMEOUT = 60000; // 60 seconds for complex graph operations
const MAX_NODES_PER_REQUEST = 1000;
const MAX_DEPTH = 5;
const DEFAULT_RETRY_ATTEMPTS = 3;

/**
 * Interface for graph generation options with validation constraints
 */
interface GraphGenerationOptions {
  depth?: number;
  maxNodes?: number;
  includeRelated?: boolean;
  qualityThreshold?: number;
  timeout?: number;
  retryAttempts?: number;
  securityLevel?: 'basic' | 'enhanced' | 'strict';
}

/**
 * Interface for graph update options
 */
interface GraphUpdateOptions {
  mergeStrategy?: 'replace' | 'append' | 'smart';
  validateRelationships?: boolean;
  preserveMetadata?: boolean;
}

/**
 * Interface for graph query parameters
 */
interface GraphQueryParams {
  includeMetadata?: boolean;
  depth?: number;
  nodeTypes?: string[];
  relationshipTypes?: string[];
}

/**
 * Knowledge Graph API client with comprehensive security and monitoring
 */
const graphApi = {
  /**
   * Generates a new knowledge graph for a given topic
   * @param topicId - Unique identifier for the topic
   * @param options - Graph generation options
   * @returns Promise resolving to graph data
   */
  async generateGraph(
    topicId: string,
    options: GraphGenerationOptions = {}
  ): Promise<ApiResponse<IGraphData>> {
    // Validate and sanitize inputs
    const sanitizedTopicId = sanitizeInput(topicId);
    const validatedOptions = validateGraphOptions(options);

    // Create API request instance with security headers
    const api = createApiRequest();
    api.defaults.timeout = options.timeout || GRAPH_OPERATION_TIMEOUT;

    try {
      const response = await api.post<ApiResponse<IGraphData>>(
        API_ENDPOINTS.GRAPH.GENERATE,
        {
          topicId: sanitizedTopicId,
          ...validatedOptions
        },
        {
          headers: {
            'X-Security-Level': options.securityLevel || 'enhanced',
            'X-Operation-ID': `graph-gen-${Date.now()}`
          }
        }
      );

      return response.data;
    } catch (error) {
      throw handleGraphError(error, 'Graph Generation Error');
    }
  },

  /**
   * Retrieves an existing knowledge graph by ID
   * @param graphId - Unique identifier for the graph
   * @param params - Query parameters for graph retrieval
   * @returns Promise resolving to graph data
   */
  async getGraph(
    graphId: string,
    params: GraphQueryParams = {}
  ): Promise<ApiResponse<IGraphData>> {
    const sanitizedGraphId = sanitizeInput(graphId);
    const api = createApiRequest();

    try {
      const response = await api.get<ApiResponse<IGraphData>>(
        `${API_ENDPOINTS.GRAPH.GET.replace(':id', sanitizedGraphId)}`,
        {
          params: {
            ...params,
            timestamp: Date.now()
          }
        }
      );

      return response.data;
    } catch (error) {
      throw handleGraphError(error, 'Graph Retrieval Error');
    }
  },

  /**
   * Updates an existing knowledge graph
   * @param graphId - Unique identifier for the graph
   * @param updates - Graph data updates
   * @param options - Update options
   * @returns Promise resolving to updated graph data
   */
  async updateGraph(
    graphId: string,
    updates: Partial<IGraphData>,
    options: GraphUpdateOptions = {}
  ): Promise<ApiResponse<IGraphData>> {
    const sanitizedGraphId = sanitizeInput(graphId);
    const api = createApiRequest();

    try {
      const response = await api.put<ApiResponse<IGraphData>>(
        `${API_ENDPOINTS.GRAPH.UPDATE.replace(':id', sanitizedGraphId)}`,
        {
          updates,
          options
        },
        {
          headers: {
            'X-Update-Strategy': options.mergeStrategy || 'smart',
            'X-Validation-Level': options.validateRelationships ? 'strict' : 'basic'
          }
        }
      );

      return response.data;
    } catch (error) {
      throw handleGraphError(error, 'Graph Update Error');
    }
  },

  /**
   * Retrieves relationships for a specific graph
   * @param graphId - Unique identifier for the graph
   * @param params - Query parameters for relationship retrieval
   * @returns Promise resolving to graph relationships
   */
  async getGraphRelationships(
    graphId: string,
    params: GraphQueryParams = {}
  ): Promise<ApiResponse<IGraphRelationship[]>> {
    const sanitizedGraphId = sanitizeInput(graphId);
    const api = createApiRequest();

    try {
      const response = await api.get<ApiResponse<IGraphRelationship[]>>(
        `${API_ENDPOINTS.GRAPH.RELATIONSHIPS.replace(':id', sanitizedGraphId)}`,
        { params }
      );

      return response.data;
    } catch (error) {
      throw handleGraphError(error, 'Relationship Retrieval Error');
    }
  },

  /**
   * Retrieves nodes for a specific graph
   * @param graphId - Unique identifier for the graph
   * @param params - Query parameters for node retrieval
   * @returns Promise resolving to graph nodes
   */
  async getGraphNodes(
    graphId: string,
    params: GraphQueryParams = {}
  ): Promise<ApiResponse<IGraphNode[]>> {
    const sanitizedGraphId = sanitizeInput(graphId);
    const api = createApiRequest();

    try {
      const response = await api.get<ApiResponse<IGraphNode[]>>(
        `${API_ENDPOINTS.GRAPH.NODES.replace(':id', sanitizedGraphId)}`,
        { params }
      );

      return response.data;
    } catch (error) {
      throw handleGraphError(error, 'Node Retrieval Error');
    }
  }
};

/**
 * Validates graph generation options
 * @param options - Options to validate
 * @returns Validated options object
 */
function validateGraphOptions(options: GraphGenerationOptions): GraphGenerationOptions {
  const validated: GraphGenerationOptions = { ...options };

  // Validate depth
  if (validated.depth !== undefined) {
    validated.depth = Math.min(Math.max(1, validated.depth), MAX_DEPTH);
  }

  // Validate maxNodes
  if (validated.maxNodes !== undefined) {
    validated.maxNodes = Math.min(validated.maxNodes, MAX_NODES_PER_REQUEST);
  }

  // Validate timeout
  if (validated.timeout !== undefined) {
    validated.timeout = Math.max(validated.timeout, 5000); // Minimum 5 seconds
  }

  // Validate retry attempts
  if (validated.retryAttempts !== undefined) {
    validated.retryAttempts = Math.min(validated.retryAttempts, DEFAULT_RETRY_ATTEMPTS);
  }

  return validated;
}

/**
 * Handles graph-specific API errors with enhanced context
 * @param error - Error object
 * @param context - Error context description
 * @throws Enhanced error with context
 */
function handleGraphError(error: any, context: string): never {
  const errorMessage = error.response?.data?.message || error.message;
  const errorCode = error.response?.status;
  const requestId = error.config?.headers?.['X-Request-ID'];

  // Log error for monitoring
  console.error('[Graph API Error]', {
    context,
    errorCode,
    errorMessage,
    requestId,
    timestamp: new Date().toISOString()
  });

  throw new Error(`${context}: ${errorMessage}`);
}

// Export the graph API client
export default graphApi;