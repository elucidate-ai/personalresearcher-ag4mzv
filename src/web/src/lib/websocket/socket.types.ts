/**
 * @fileoverview WebSocket types and interfaces for real-time communication
 * @version 1.0.0
 * 
 * Provides comprehensive TypeScript definitions for WebSocket functionality
 * including connection states, message formats, configuration options,
 * and type-safe message handlers to support real-time updates and 
 * high availability requirements.
 */

/**
 * Enumeration of WebSocket connection states including reconnection state
 * for implementing high availability requirements (99.9% uptime)
 */
export enum WebSocketState {
    CONNECTING = 0,
    OPEN = 1,
    CLOSED = 2,
    RECONNECTING = 3
}

/**
 * Enumeration of all possible WebSocket message types for type-safe
 * communication across the system
 */
export enum WebSocketMessageType {
    CONTENT_UPDATE = 'CONTENT_UPDATE',
    GRAPH_UPDATE = 'GRAPH_UPDATE',
    EXPORT_PROGRESS = 'EXPORT_PROGRESS',
    HEARTBEAT = 'HEARTBEAT',
    ERROR = 'ERROR'
}

/**
 * Interface defining the structure of WebSocket messages with required
 * metadata for tracking and versioning
 */
export interface WebSocketMessage {
    /** The type of message being sent */
    type: WebSocketMessageType;
    
    /** The message payload - type varies based on message type */
    payload: unknown;
    
    /** Unix timestamp of when the message was created */
    timestamp: number;
    
    /** Message format version for backward compatibility */
    version: string;
}

/**
 * Interface for WebSocket client configuration including parameters
 * for high availability and reconnection strategies
 */
export interface WebSocketConfig {
    /** WebSocket server URL */
    url: string;
    
    /** Maximum number of reconnection attempts */
    reconnectAttempts: number;
    
    /** Delay between reconnection attempts in milliseconds */
    reconnectInterval: number;
    
    /** Connection timeout in milliseconds */
    connectionTimeout: number;
    
    /** Interval for sending heartbeat messages in milliseconds */
    heartbeatInterval: number;
}

/**
 * Type definition for message handler functions that process
 * incoming WebSocket messages asynchronously
 * 
 * @param message The received WebSocket message
 * @returns Promise that resolves when message processing is complete
 */
export type WebSocketMessageHandler = (message: WebSocketMessage) => Promise<void>;

/**
 * Type definition for error handler functions that handle WebSocket
 * errors with connection state context
 * 
 * @param error The error that occurred
 * @param state Current WebSocket connection state
 */
export type WebSocketErrorHandler = (error: Error, state: WebSocketState) => void;

/**
 * Type guard to check if a message is a valid WebSocketMessage
 * 
 * @param message The message to validate
 * @returns True if message matches WebSocketMessage interface
 */
export function isWebSocketMessage(message: unknown): message is WebSocketMessage {
    return (
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        'payload' in message &&
        'timestamp' in message &&
        'version' in message &&
        typeof (message as WebSocketMessage).timestamp === 'number' &&
        typeof (message as WebSocketMessage).version === 'string'
    );
}

/**
 * Type guard to check if a value is a valid WebSocketMessageType
 * 
 * @param value The value to validate
 * @returns True if value is a valid WebSocketMessageType
 */
export function isWebSocketMessageType(value: unknown): value is WebSocketMessageType {
    return (
        typeof value === 'string' &&
        Object.values(WebSocketMessageType).includes(value as WebSocketMessageType)
    );
}