// External dependencies with versions
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'; // v1.6.x
import * as grpc from '@grpc/grpc-js'; // v1.9.x
import { v4 as uuidv4 } from 'uuid'; // v9.x

// Internal imports
import { TestLogger } from './test-logger';
import { setupTestEnvironment } from './test-helpers';
import { ApiResponse } from '../../backend/api-gateway/src/types';

// Constants for configuration
const DEFAULT_TIMEOUT = 30000;
const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

/**
 * Enhanced test client for making HTTP and gRPC requests with comprehensive error handling
 */
export class TestClient {
    private logger: TestLogger;
    private httpClient: AxiosInstance;
    private grpcClients: Map<string, any>;
    private requestCache: Map<string, any>;
    private retryConfig: {
        maxRetries: number;
        delay: number;
    };

    constructor(config: {
        baseURL?: string;
        timeout?: number;
        logger?: TestLogger;
        retryConfig?: { maxRetries: number; delay: number };
    } = {}) {
        // Initialize logger with correlation tracking
        this.logger = config.logger || new TestLogger();

        // Configure axios client with interceptors
        this.httpClient = axios.create({
            baseURL: config.baseURL || BASE_URL,
            timeout: config.timeout || DEFAULT_TIMEOUT,
            validateStatus: (status) => status < 500
        });

        // Add request interceptor for correlation ID
        this.httpClient.interceptors.request.use((config) => {
            const correlationId = uuidv4();
            config.headers['X-Correlation-ID'] = correlationId;
            this.logger.info('Making HTTP request', {
                method: config.method,
                url: config.url,
                correlationId
            });
            return config;
        });

        // Add response interceptor for logging
        this.httpClient.interceptors.response.use(
            (response) => {
                this.logger.info('Received HTTP response', {
                    status: response.status,
                    correlationId: response.config.headers['X-Correlation-ID']
                });
                return response;
            },
            (error) => {
                this.logger.error('HTTP request failed', {
                    error: error.message,
                    correlationId: error.config?.headers['X-Correlation-ID']
                });
                return Promise.reject(error);
            }
        );

        // Initialize gRPC clients map
        this.grpcClients = new Map();

        // Initialize request cache
        this.requestCache = new Map();

        // Set retry configuration
        this.retryConfig = config.retryConfig || {
            maxRetries: MAX_RETRIES,
            delay: RETRY_DELAY
        };
    }

    /**
     * Makes a GET request with caching
     */
    async get<T = any>(endpoint: string, config: AxiosRequestConfig = {}): Promise<ApiResponse<T>> {
        const cacheKey = `GET:${endpoint}`;
        const cachedResponse = this.requestCache.get(cacheKey);

        if (cachedResponse && !config.headers?.['force-refresh']) {
            this.logger.debug('Returning cached response', { endpoint });
            return cachedResponse;
        }

        const response = await this.makeRequest<T>('GET', endpoint, undefined, config);
        
        if (response.success) {
            this.requestCache.set(cacheKey, response);
        }

        return response;
    }

    /**
     * Makes a POST request with validation
     */
    async post<T = any>(
        endpoint: string,
        data?: any,
        config: AxiosRequestConfig = {}
    ): Promise<ApiResponse<T>> {
        return this.makeRequest<T>('POST', endpoint, data, config);
    }

    /**
     * Makes a gRPC request with retry logic
     */
    async grpc<T = any>(
        service: string,
        method: string,
        request: any,
        options: grpc.CallOptions = {}
    ): Promise<T> {
        const correlationId = uuidv4();
        
        try {
            // Get or create gRPC client
            let client = this.grpcClients.get(service);
            if (!client) {
                client = await this.createGrpcClient(service);
                this.grpcClients.set(service, client);
            }

            // Add correlation ID to metadata
            const metadata = new grpc.Metadata();
            metadata.set('correlation-id', correlationId);

            this.logger.info('Making gRPC request', {
                service,
                method,
                correlationId
            });

            // Make gRPC call with retry logic
            for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
                try {
                    const response = await new Promise<T>((resolve, reject) => {
                        client[method](request, metadata, options, (error: any, response: T) => {
                            if (error) {
                                reject(error);
                            } else {
                                resolve(response);
                            }
                        });
                    });

                    this.logger.info('gRPC request successful', {
                        service,
                        method,
                        correlationId
                    });

                    return response;
                } catch (error) {
                    if (attempt === this.retryConfig.maxRetries) {
                        throw error;
                    }
                    await new Promise(resolve => setTimeout(resolve, this.retryConfig.delay * attempt));
                }
            }

            throw new Error('All retry attempts failed');
        } catch (error) {
            this.logger.error('gRPC request failed', {
                service,
                method,
                error: error.message,
                correlationId
            });
            throw error;
        }
    }

    /**
     * Makes an HTTP request with retry logic and correlation tracking
     */
    private async makeRequest<T = any>(
        method: string,
        endpoint: string,
        data?: any,
        config: AxiosRequestConfig = {}
    ): Promise<ApiResponse<T>> {
        const correlationId = uuidv4();

        for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
            try {
                const response = await this.httpClient.request({
                    method,
                    url: endpoint,
                    data,
                    ...config,
                    headers: {
                        ...config.headers,
                        'X-Correlation-ID': correlationId
                    }
                });

                return {
                    success: response.status < 400,
                    data: response.data,
                    error: response.status >= 400 ? response.data?.error : undefined,
                    correlationId
                };
            } catch (error) {
                if (attempt === this.retryConfig.maxRetries) {
                    return {
                        success: false,
                        error: error.message,
                        correlationId
                    };
                }
                await new Promise(resolve => setTimeout(resolve, this.retryConfig.delay * attempt));
            }
        }

        return {
            success: false,
            error: 'Request failed after all retry attempts',
            correlationId
        };
    }

    /**
     * Creates a gRPC client for the specified service
     */
    private async createGrpcClient(service: string): Promise<any> {
        // Service-specific client creation logic would go here
        // This is a placeholder implementation
        throw new Error('gRPC client creation not implemented');
    }

    /**
     * Cleans up resources and closes connections
     */
    async cleanup(): Promise<void> {
        this.requestCache.clear();
        this.grpcClients.forEach(client => client.close());
        this.grpcClients.clear();
    }
}

/**
 * Standalone HTTP request helper with retry logic
 */
export async function makeRequest<T = any>(
    method: string,
    endpoint: string,
    data?: any,
    config: AxiosRequestConfig = {}
): Promise<ApiResponse<T>> {
    const client = new TestClient();
    return method.toLowerCase() === 'get' 
        ? client.get<T>(endpoint, config)
        : client.post<T>(endpoint, data, config);
}

/**
 * Standalone gRPC request helper with error handling
 */
export async function makeGrpcRequest<T = any>(
    service: string,
    method: string,
    request: any,
    options: grpc.CallOptions = {}
): Promise<T> {
    const client = new TestClient();
    return client.grpc<T>(service, method, request, options);
}