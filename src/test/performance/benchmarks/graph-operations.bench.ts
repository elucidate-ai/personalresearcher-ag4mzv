import { benchmark } from '@jest/benchmark';  // @jest/benchmark v29.0.0
import { faker } from '@faker-js/faker';  // @faker-js/faker v8.0.0
import { GraphBuilder } from '../../../backend/knowledge-organization/app/core/graph_builder';
import { GraphOptimizer } from '../../../backend/knowledge-organization/app/core/graph_optimizer';

// Constants for benchmark configuration
const BENCHMARK_ITERATIONS = 1000;
const BENCHMARK_TIMEOUT = 60000; // 60 seconds
const MIN_NODES = 100;
const MAX_NODES = 10000;
const MEMORY_BASELINE = process.memoryUsage();

/**
 * Generate test nodes with comprehensive properties and relationships
 * 
 * @param count Number of nodes to generate
 * @returns Array of test nodes
 */
function generateTestNodes(count: number) {
  const nodes = [];
  
  for (let i = 0; i < count; i++) {
    // Generate realistic node data
    const node = {
      id: faker.string.uuid(),
      name: faker.company.catchPhrase(),
      content: faker.lorem.paragraphs(3),
      type: faker.helpers.arrayElement(['CONCEPT', 'TOPIC', 'SUBTOPIC']),
      vector: Array.from({ length: 384 }, () => faker.number.float({ min: -1, max: 1 })),
      quality_score: faker.number.float({ min: 0, max: 1 }),
      metadata: {
        source: faker.internet.url(),
        timestamp: faker.date.recent().toISOString(),
        content_type: faker.helpers.arrayElement(['article', 'video', 'book']),
        author: faker.person.fullName(),
        tags: Array.from({ length: 3 }, () => faker.word.sample())
      },
      properties: {
        level: faker.number.int({ min: 1, max: 5 }),
        complexity: faker.number.float({ min: 0, max: 1 }),
        relevance: faker.number.float({ min: 0, max: 1 })
      }
    };
    nodes.push(node);
  }

  return nodes;
}

/**
 * Comprehensive benchmark suite for graph construction performance
 */
export async function benchmarkGraphConstruction(suite: any) {
  const graphBuilder = new GraphBuilder();
  
  suite
    .add('Graph Construction - Small (100 nodes)', {
      iterations: BENCHMARK_ITERATIONS,
      timeout: BENCHMARK_TIMEOUT,
      async fn() {
        const nodes = generateTestNodes(100);
        const initialMemory = process.memoryUsage();
        
        const graph = await graphBuilder.build_graph(
          nodes,
          'test-graph-small',
          { benchmark: true }
        );
        
        // Validate minimum connections requirement
        const complexity = await graphBuilder.validate_graph_complexity(graph);
        if (!complexity) {
          throw new Error('Graph complexity validation failed');
        }
        
        // Track memory impact
        const finalMemory = process.memoryUsage();
        const memoryDelta = {
          heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
          heapTotal: finalMemory.heapTotal - initialMemory.heapTotal
        };
        
        return { graph, memoryDelta };
      }
    })
    .add('Graph Construction - Medium (1000 nodes)', {
      iterations: Math.floor(BENCHMARK_ITERATIONS / 10),
      timeout: BENCHMARK_TIMEOUT,
      async fn() {
        const nodes = generateTestNodes(1000);
        const initialMemory = process.memoryUsage();
        
        const graph = await graphBuilder.build_graph(
          nodes,
          'test-graph-medium',
          { benchmark: true }
        );
        
        // Validate graph density
        const density = await graphBuilder.calculate_density(graph);
        if (density < 0.1) { // Minimum density threshold
          throw new Error('Graph density below threshold');
        }
        
        const finalMemory = process.memoryUsage();
        return {
          graph,
          memoryDelta: {
            heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
            heapTotal: finalMemory.heapTotal - initialMemory.heapTotal
          }
        };
      }
    })
    .add('Graph Construction - Large (10000 nodes)', {
      iterations: Math.floor(BENCHMARK_ITERATIONS / 100),
      timeout: BENCHMARK_TIMEOUT * 2,
      async fn() {
        const nodes = generateTestNodes(10000);
        const initialMemory = process.memoryUsage();
        
        const graph = await graphBuilder.build_graph(
          nodes,
          'test-graph-large',
          { benchmark: true }
        );
        
        // Track memory usage during construction
        const memoryUsage = await graphBuilder.measure_memory_usage(graph);
        
        const finalMemory = process.memoryUsage();
        return {
          graph,
          memoryUsage,
          memoryDelta: {
            heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
            heapTotal: finalMemory.heapTotal - initialMemory.heapTotal
          }
        };
      }
    });
}

/**
 * Performance benchmark for graph optimization operations
 */
export async function benchmarkGraphOptimization(suite: any) {
  const graphOptimizer = new GraphOptimizer();
  const graphBuilder = new GraphBuilder();
  
  suite
    .add('Graph Optimization - Small Graph', {
      iterations: BENCHMARK_ITERATIONS,
      timeout: BENCHMARK_TIMEOUT,
      async fn() {
        // Build test graph
        const nodes = generateTestNodes(100);
        const graph = await graphBuilder.build_graph(nodes, 'optimization-test-small');
        
        // Measure optimization performance
        const initialMetrics = await graphOptimizer.calculate_metrics(graph);
        const initialMemory = process.memoryUsage();
        
        const optimizedGraph = await graphOptimizer.optimize(graph);
        
        // Validate optimization results
        const finalMetrics = await graphOptimizer.calculate_metrics(optimizedGraph);
        const memoryImpact = await graphOptimizer.track_memory_impact(graph);
        
        return {
          improvement: {
            density: finalMetrics.density - initialMetrics.density,
            clustering: finalMetrics.average_clustering - initialMetrics.average_clustering
          },
          memoryImpact
        };
      }
    })
    .add('Graph Optimization - Relationship Rebalancing', {
      iterations: Math.floor(BENCHMARK_ITERATIONS / 10),
      timeout: BENCHMARK_TIMEOUT,
      async fn() {
        const nodes = generateTestNodes(500);
        const graph = await graphBuilder.build_graph(nodes, 'rebalancing-test');
        
        // Test relationship rebalancing performance
        const initialConnections = await graphOptimizer.calculate_metrics(graph);
        await graphOptimizer.rebalance_relationships(graph);
        const finalConnections = await graphOptimizer.calculate_metrics(graph);
        
        return {
          connectionsDelta: finalConnections.average_degree - initialConnections.average_degree
        };
      }
    });
}

/**
 * Comprehensive benchmark suite for graph query operations
 */
export async function benchmarkGraphQueries(suite: any) {
  const graphBuilder = new GraphBuilder();
  
  suite
    .add('Graph Queries - Path Finding', {
      iterations: BENCHMARK_ITERATIONS,
      timeout: BENCHMARK_TIMEOUT,
      async fn() {
        const nodes = generateTestNodes(500);
        const graph = await graphBuilder.build_graph(nodes, 'query-test-paths');
        
        // Measure path finding performance
        const startNode = nodes[0].id;
        const endNode = nodes[nodes.length - 1].id;
        
        const startTime = process.hrtime();
        const paths = await graph.traverse_async(startNode, {
          maxDepth: 5,
          targetNode: endNode
        });
        const [seconds, nanoseconds] = process.hrtime(startTime);
        
        return {
          pathsFound: paths.length,
          duration: seconds * 1000 + nanoseconds / 1e6 // Convert to milliseconds
        };
      }
    })
    .add('Graph Queries - Relationship Traversal', {
      iterations: BENCHMARK_ITERATIONS,
      timeout: BENCHMARK_TIMEOUT,
      async fn() {
        const nodes = generateTestNodes(300);
        const graph = await graphBuilder.build_graph(nodes, 'query-test-traversal');
        
        // Test relationship traversal performance
        const startTime = process.hrtime();
        const traversalResults = await graph.traverse_async(nodes[0].id, {
          relationshipTypes: ['IS_PREREQUISITE', 'CONTAINS'],
          maxDepth: 3
        });
        const [seconds, nanoseconds] = process.hrtime(startTime);
        
        return {
          nodesTraversed: traversalResults.nodes.length,
          duration: seconds * 1000 + nanoseconds / 1e6
        };
      }
    });
}