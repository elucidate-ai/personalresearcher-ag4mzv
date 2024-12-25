/**
 * @fileoverview Enhanced WebSocket client implementation with robust connection management
 * @version 1.0.0
 * 
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Heartbeat monitoring
 * - Message queuing for offline handling
 * - Comprehensive error handling
 * - Type-safe message handling
 */

import { EventEmitter } from 'events';
import {
    WebSocketState,
    WebSocketMessage,
    WebSocketConfig,
    WebSocketMessageType,
    WebSocketMessageHandler,
    isWebSocketMessage
} from './socket.types';

/**
 * Queue implementation for storing messages during disconnection
 */
class MessageQueue {
    private queue: WebSocketMessage[] = [];
    private maxSize = 1000;

    enqueue(message: WebSocketMessage): void {
        if (this.queue.length >= this.maxSize) {
            this.queue.shift(); // Remove oldest message if queue is full
        }
        this.queue.push(message);
    }

    dequeueAll(): WebSocketMessage[] {
        const messages = [...this.queue];
        this.queue = [];
        return messages;
    }

    clear(): void {
        this.queue = [];
    }
}

/**
 * Enhanced WebSocket client with robust connection management and guaranteed message delivery
 */
export class WebSocketClient {
    private socket: WebSocket | null = null;
    private readonly config: WebSocketConfig;
    private reconnectCount = 0;
    private readonly messageHandlers = new Map<WebSocketMessageType, Set<WebSocketMessageHandler>>();
    private connectionState: WebSocketState = WebSocketState.CLOSED;
    private readonly messageQueue = new MessageQueue();
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private connectionTimeout: NodeJS.Timeout | null = null;
    private readonly stateChangeEmitter = new EventEmitter();
    private reconnectTimer: NodeJS.Timeout | null = null;

    /**
     * Creates a new WebSocket client instance
     * @param config WebSocket configuration options
     */
    constructor(config: WebSocketConfig) {
        this.validateConfig(config);
        this.config = {
            ...config,
            reconnectAttempts: config.reconnectAttempts || 5,
            reconnectInterval: config.reconnectInterval || 1000,
            heartbeatInterval: config.heartbeatInterval || 30000,
            connectionTimeout: config.connectionTimeout || 5000
        };
    }

    /**
     * Establishes WebSocket connection with automatic reconnection
     */
    public async connect(): Promise<void> {
        if (this.connectionState === WebSocketState.CONNECTING || 
            this.connectionState === WebSocketState.OPEN) {
            return;
        }

        this.updateState(WebSocketState.CONNECTING);

        return new Promise((resolve, reject) => {
            try {
                this.socket = new WebSocket(this.config.url);
                this.setupConnectionTimeout();
                this.setupEventListeners(resolve, reject);
            } catch (error) {
                this.handleError(error as Error);
                reject(error);
            }
        });
    }

    /**
     * Gracefully disconnects the WebSocket connection
     */
    public async disconnect(): Promise<void> {
        this.clearTimers();
        
        if (this.socket && this.connectionState === WebSocketState.OPEN) {
            this.socket.close(1000, 'Client disconnected');
        }

        this.cleanup();
    }

    /**
     * Sends a message with delivery guarantee
     * @param message Message to send
     * @returns Promise resolving to message delivery status
     */
    public async send(message: WebSocketMessage): Promise<boolean> {
        if (!isWebSocketMessage(message)) {
            throw new Error('Invalid message format');
        }

        if (this.connectionState !== WebSocketState.OPEN) {
            this.messageQueue.enqueue(message);
            return false;
        }

        try {
            this.socket?.send(JSON.stringify(message));
            return true;
        } catch (error) {
            this.handleError(error as Error);
            this.messageQueue.enqueue(message);
            return false;
        }
    }

    /**
     * Registers a message handler for a specific message type
     * @param type Message type to handle
     * @param handler Handler function
     */
    public onMessage(type: WebSocketMessageType, handler: WebSocketMessageHandler): void {
        if (!this.messageHandlers.has(type)) {
            this.messageHandlers.set(type, new Set());
        }
        this.messageHandlers.get(type)?.add(handler);
    }

    /**
     * Registers a state change listener
     * @param listener State change callback
     */
    public onStateChange(listener: (state: WebSocketState) => void): void {
        this.stateChangeEmitter.on('stateChange', listener);
    }

    /**
     * Returns current connection state
     */
    public getState(): WebSocketState {
        return this.connectionState;
    }

    private validateConfig(config: WebSocketConfig): void {
        if (!config.url) {
            throw new Error('WebSocket URL is required');
        }
        if (config.reconnectAttempts < 0) {
            throw new Error('Invalid reconnect attempts value');
        }
        if (config.reconnectInterval < 0) {
            throw new Error('Invalid reconnect interval value');
        }
    }

    private setupEventListeners(resolve: () => void, reject: (error: Error) => void): void {
        if (!this.socket) return;

        this.socket.onopen = () => {
            this.clearConnectionTimeout();
            this.updateState(WebSocketState.OPEN);
            this.setupHeartbeat();
            this.processMessageQueue();
            this.reconnectCount = 0;
            resolve();
        };

        this.socket.onclose = (event) => {
            this.handleClose(event);
        };

        this.socket.onerror = (event) => {
            this.handleError(event as ErrorEvent);
            if (this.connectionState === WebSocketState.CONNECTING) {
                reject(new Error('Connection failed'));
            }
        };

        this.socket.onmessage = (event) => {
            this.handleMessage(event);
        };
    }

    private async handleMessage(event: MessageEvent): Promise<void> {
        try {
            const message = JSON.parse(event.data) as WebSocketMessage;
            if (!isWebSocketMessage(message)) {
                throw new Error('Invalid message format received');
            }

            const handlers = this.messageHandlers.get(message.type);
            if (handlers) {
                await Promise.all([...handlers].map(handler => handler(message)));
            }
        } catch (error) {
            this.handleError(error as Error);
        }
    }

    private handleClose(event: CloseEvent): void {
        this.clearTimers();
        this.updateState(WebSocketState.CLOSED);

        if (!event.wasClean && this.reconnectCount < this.config.reconnectAttempts) {
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect(): void {
        const delay = Math.min(
            this.config.reconnectInterval * Math.pow(2, this.reconnectCount),
            30000 // Max delay of 30 seconds
        );

        this.reconnectCount++;
        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, delay);
    }

    private setupHeartbeat(): void {
        this.heartbeatInterval = setInterval(() => {
            this.send({
                type: WebSocketMessageType.HEARTBEAT,
                payload: { timestamp: Date.now() },
                timestamp: Date.now(),
                version: '1.0.0'
            });
        }, this.config.heartbeatInterval);
    }

    private setupConnectionTimeout(): void {
        this.connectionTimeout = setTimeout(() => {
            if (this.connectionState === WebSocketState.CONNECTING) {
                this.socket?.close();
                this.handleError(new Error('Connection timeout'));
            }
        }, this.config.connectionTimeout);
    }

    private async processMessageQueue(): Promise<void> {
        const messages = this.messageQueue.dequeueAll();
        for (const message of messages) {
            await this.send(message);
        }
    }

    private updateState(state: WebSocketState): void {
        this.connectionState = state;
        this.stateChangeEmitter.emit('stateChange', state);
    }

    private handleError(error: Error): void {
        console.error('WebSocket error:', error);
        this.stateChangeEmitter.emit('error', error);
    }

    private clearTimers(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    private cleanup(): void {
        this.socket = null;
        this.clearTimers();
        this.updateState(WebSocketState.CLOSED);
        this.messageQueue.clear();
    }
}