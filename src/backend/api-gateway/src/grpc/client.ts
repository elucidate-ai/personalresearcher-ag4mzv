import * as grpc from '@grpc/grpc-js'; // ^1.9.0
import * as protoLoader from '@grpc/proto-loader'; // ^0.7.0
import CircuitBreaker from 'circuit-breaker-js'; // ^0.5.0
import { services } from '../config/config';
import { EventEmitter } from 'events';

// Type definitions
interface ConnectionPool {
  connections: grpc.Client[];
  currentIndex: number;
  maxSize: number;
}

interface HealthStatus {
  serviceName: string;
  status: 'SERVING' | 'NOT_SERVING' | 'UNKNOWN';
  lastCheck: Date;
  responseTime: number;
}

interface MetricsData {
  requestCount: number;
  errorCount: number;
  avgResponseTime: number;
  lastError?: Error;
}

class MetricsCollector {
  private metrics: Map<string, MetricsData> = new Map();

  updateMetrics(serviceName: string, responseTime: number, error?: Error): void {
    const current = this.metrics.get(serviceName) || {
      requestCount: 0,
      errorCount: 0,
      avgResponseTime: 0
    };

    current.requestCount++;
    if (error) {
      current.errorCount++;
      current.lastError = error;
    }
    current.avgResponseTime = (current.avgResponseTime * (current.requestCount - 1) + responseTime) / current.requestCount;
    this.metrics.set(serviceName, current);
  }

  getMetrics(serviceName: string): MetricsData | undefined {
    return this.metrics.get(serviceName);
  }
}

export class GrpcClientManager extends EventEmitter {
  private connectionPools: Map<string, ConnectionPool> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private metricsCollector: MetricsCollector = new MetricsCollector();
  private healthStatuses: Map<string, HealthStatus> = new Map();

  constructor() {
    super();
    this.initializeServices();
    this.startHealthChecks();
  }

  private async initializeServices(): Promise<void> {
    for (const [serviceName, config] of Object.entries(services)) {
      await this.initializeService(serviceName, config);
    }
  }

  private async initializeService(serviceName: string, config: any): Promise<void> {
    // Initialize connection pool
    const pool: ConnectionPool = {
      connections: [],
      currentIndex: 0,
      maxSize: 5 // Configurable pool size
    };

    // Create initial connections
    for (let i = 0; i < pool.maxSize; i++) {
      const client = await this.createServiceClient(serviceName, config);
      pool.connections.push(client);
    }

    this.connectionPools.set(serviceName, pool);

    // Initialize circuit breaker
    const breaker = new CircuitBreaker({
      windowDuration: 10000, // 10 seconds
      numBuckets: 10,
      timeoutDuration: 3000,
      errorThreshold: 50,
      volumeThreshold: 10
    });

    this.circuitBreakers.set(serviceName, breaker);
  }

  private async createServiceClient(serviceName: string, config: any): Promise<grpc.Client> {
    const protoPath = `${__dirname}/protos/${serviceName}.proto`;
    
    try {
      const packageDefinition = await protoLoader.load(protoPath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      });

      const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
      const ServiceClass = protoDescriptor[serviceName];

      return new ServiceClass(
        `${config.host}:${config.port}`,
        grpc.credentials.createInsecure(),
        {
          'grpc.keepalive_time_ms': 10000,
          'grpc.keepalive_timeout_ms': 5000,
          'grpc.keepalive_permit_without_calls': 1,
          'grpc.http2.max_pings_without_data': 0,
          'grpc.http2.min_time_between_pings_ms': 10000,
          'grpc.http2.min_ping_interval_without_data_ms': 5000
        }
      );
    } catch (error) {
      this.emit('error', `Failed to create client for ${serviceName}:`, error);
      throw error;
    }
  }

  public async getClient(serviceName: string): Promise<grpc.Client> {
    const pool = this.connectionPools.get(serviceName);
    const breaker = this.circuitBreakers.get(serviceName);

    if (!pool || !breaker) {
      throw new Error(`Service ${serviceName} not initialized`);
    }

    if (breaker.isOpen()) {
      throw new Error(`Circuit breaker is open for ${serviceName}`);
    }

    // Round-robin connection selection
    pool.currentIndex = (pool.currentIndex + 1) % pool.maxSize;
    const client = pool.connections[pool.currentIndex];

    // Wrap client in circuit breaker
    return new Proxy(client, {
      get: (target, prop) => {
        const original = target[prop];
        if (typeof original === 'function') {
          return async (...args: any[]) => {
            const startTime = Date.now();
            try {
              const result = await breaker.run(() => original.apply(target, args));
              this.metricsCollector.updateMetrics(serviceName, Date.now() - startTime);
              return result;
            } catch (error) {
              this.metricsCollector.updateMetrics(serviceName, Date.now() - startTime, error as Error);
              await this.handleConnectionError(error as Error, serviceName);
              throw error;
            }
          };
        }
        return original;
      }
    });
  }

  private async handleConnectionError(error: Error, serviceName: string): Promise<void> {
    this.emit('connectionError', { serviceName, error });

    const pool = this.connectionPools.get(serviceName);
    const config = services[serviceName];

    if (pool) {
      // Replace failed connection
      const newClient = await this.createServiceClient(serviceName, config);
      pool.connections[pool.currentIndex] = newClient;
    }
  }

  private startHealthChecks(): void {
    setInterval(async () => {
      for (const [serviceName, pool] of this.connectionPools) {
        try {
          const status = await this.checkServiceHealth(serviceName, pool);
          this.healthStatuses.set(serviceName, status);
          this.emit('healthCheck', status);
        } catch (error) {
          this.emit('healthCheckError', { serviceName, error });
        }
      }
    }, 30000); // Check every 30 seconds
  }

  private async checkServiceHealth(serviceName: string, pool: ConnectionPool): Promise<HealthStatus> {
    const startTime = Date.now();
    const client = pool.connections[pool.currentIndex];

    return new Promise((resolve) => {
      client.waitForReady(Date.now() + 5000, (error) => {
        const status: HealthStatus = {
          serviceName,
          status: error ? 'NOT_SERVING' : 'SERVING',
          lastCheck: new Date(),
          responseTime: Date.now() - startTime
        };
        resolve(status);
      });
    });
  }

  public getHealthStatus(serviceName: string): HealthStatus | undefined {
    return this.healthStatuses.get(serviceName);
  }

  public getMetrics(serviceName: string): MetricsData | undefined {
    return this.metricsCollector.getMetrics(serviceName);
  }
}

// Export singleton instance
export const grpcClientManager = new GrpcClientManager();