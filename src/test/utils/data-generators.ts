// External imports with versions
import { faker } from '@faker-js/faker'; // ^8.0.0
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0
import dayjs from 'dayjs'; // ^1.11.0
import now from 'performance-now'; // ^2.1.0

// Internal imports
import { mockContentItems } from '../fixtures/content.json';
import { graphs } from '../fixtures/graphs.json';
import { test_vectors } from '../fixtures/vectors.json';

// Constants for test data generation
const CONTENT_TYPES = ['video', 'podcast', 'article', 'book'] as const;
const QUALITY_SCORE_RANGE = [0.0, 1.0] as const;
const VECTOR_DIMENSION = 384;
const DEFAULT_NODE_COUNT = 50;
const DEFAULT_RELATIONSHIP_DENSITY = 0.3;
const RANDOM_SEED = 'test-data-seed';
const PERFORMANCE_THRESHOLDS = {
  content_generation_ms: 100,
  graph_generation_ms: 200,
  vector_generation_ms: 150
};
const BATCH_SIZE = 1000;
const MEMORY_LIMIT_MB = 512;

// Types for generator options
interface GeneratorOptions {
  seed?: string;
  qualityThreshold?: number;
  validateSchema?: boolean;
  monitorPerformance?: boolean;
}

interface GraphOptions extends GeneratorOptions {
  maxDepth?: number;
  relationshipTypes?: string[];
  nodeLabels?: string[];
}

interface VectorOptions extends GeneratorOptions {
  similarityThreshold?: number;
  generatePairs?: boolean;
  includeMetadata?: boolean;
}

// Performance monitoring decorator
function measurePerformance(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function(...args: any[]) {
    const start = now();
    try {
      const result = await originalMethod.apply(this, args);
      const duration = now() - start;
      
      console.log(`Performance [${propertyKey}]: ${duration.toFixed(2)}ms`);
      
      // Check against thresholds
      const threshold = PERFORMANCE_THRESHOLDS[`${propertyKey}_ms`];
      if (threshold && duration > threshold) {
        console.warn(`Performance warning: ${propertyKey} exceeded threshold (${duration.toFixed(2)}ms > ${threshold}ms)`);
      }
      
      return result;
    } catch (error) {
      console.error(`Error in ${propertyKey}:`, error);
      throw error;
    }
  };

  return descriptor;
}

/**
 * Generates mock content items with comprehensive validation and monitoring.
 * 
 * @param count Number of content items to generate
 * @param contentType Specific content type to generate
 * @param options Generator configuration options
 * @returns Array of validated mock content items
 */
@measurePerformance
export async function generateMockContent(
  count: number,
  contentType?: typeof CONTENT_TYPES[number],
  options: GeneratorOptions = {}
): Promise<any[]> {
  const {
    seed = RANDOM_SEED,
    qualityThreshold = 0.7,
    validateSchema = true,
    monitorPerformance = true
  } = options;

  // Set consistent random seed
  faker.seed(seed);

  const results = [];
  const baseItems = [...mockContentItems];

  for (let i = 0; i < count; i++) {
    try {
      const type = contentType || faker.helpers.arrayElement(CONTENT_TYPES);
      const baseItem = baseItems.find(item => item.type === type);

      const mockItem = {
        id: uuidv4(),
        topic_id: uuidv4(),
        type,
        title: faker.lorem.sentence(),
        description: faker.lorem.paragraph(),
        source_url: faker.internet.url(),
        quality_score: faker.number.float({ min: qualityThreshold, max: 1.0, precision: 0.01 }),
        metadata: generateTypeSpecificMetadata(type),
        content_type_metadata: { ...baseItem?.content_type_metadata },
        validation_metadata: {
          content_verified: true,
          last_verified: dayjs().toISOString(),
          verification_method: 'automated'
        },
        created_at: dayjs().toISOString(),
        updated_at: dayjs().toISOString()
      };

      if (validateSchema) {
        validateContentSchema(mockItem);
      }

      results.push(mockItem);

      // Memory usage check
      if (i % BATCH_SIZE === 0) {
        const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
        if (memoryUsage > MEMORY_LIMIT_MB) {
          throw new Error(`Memory limit exceeded: ${memoryUsage.toFixed(2)}MB`);
        }
      }
    } catch (error) {
      console.error(`Error generating content item ${i}:`, error);
      throw error;
    }
  }

  return results;
}

/**
 * Generates mock knowledge graph structures with configurable complexity.
 * 
 * @param nodeCount Number of nodes in the graph
 * @param relationshipDensity Density of relationships (0-1)
 * @param options Graph generation options
 * @returns Validated mock knowledge graph object
 */
@measurePerformance
export async function generateMockGraph(
  nodeCount: number = DEFAULT_NODE_COUNT,
  relationshipDensity: number = DEFAULT_RELATIONSHIP_DENSITY,
  options: GraphOptions = {}
): Promise<any> {
  const {
    seed = RANDOM_SEED,
    maxDepth = 3,
    relationshipTypes = ['CONTAINS', 'IS_PREREQUISITE', 'REFERENCES', 'EXTENDS'],
    nodeLabels = ['CONCEPT', 'TOPIC', 'PREREQUISITE', 'REFERENCE']
  } = options;

  faker.seed(seed);

  try {
    const nodes = [];
    const relationships = [];
    const baseGraph = graphs[0];

    // Generate nodes
    for (let i = 0; i < nodeCount; i++) {
      const node = {
        id: uuidv4(),
        label: faker.helpers.arrayElement(nodeLabels),
        properties: {
          name: faker.lorem.words(3),
          description: faker.lorem.sentence(),
          importance_score: faker.number.float({ min: 0, max: 1, precision: 0.01 }),
          confidence_score: faker.number.float({ min: 0.5, max: 1, precision: 0.01 }),
          source_references: Array(faker.number.int({ min: 1, max: 3 }))
            .fill(null)
            .map(() => faker.internet.url())
        },
        created_at: dayjs().toISOString(),
        updated_at: dayjs().toISOString()
      };
      nodes.push(node);
    }

    // Generate relationships based on density
    const maxRelationships = Math.floor(nodeCount * (nodeCount - 1) * relationshipDensity / 2);
    
    for (let i = 0; i < maxRelationships; i++) {
      const sourceIndex = faker.number.int({ min: 0, max: nodeCount - 1 });
      let targetIndex;
      do {
        targetIndex = faker.number.int({ min: 0, max: nodeCount - 1 });
      } while (targetIndex === sourceIndex);

      const relationship = {
        id: uuidv4(),
        source_node_id: nodes[sourceIndex].id,
        target_node_id: nodes[targetIndex].id,
        type: faker.helpers.arrayElement(relationshipTypes),
        weight: faker.number.float({ min: 0, max: 1, precision: 0.01 }),
        metadata: {
          strength: faker.number.float({ min: 0.5, max: 1, precision: 0.01 }),
          bidirectional: faker.datatype.boolean(),
          confidence_score: faker.number.float({ min: 0.7, max: 1, precision: 0.01 }),
          validation_status: 'VERIFIED'
        },
        created_at: dayjs().toISOString(),
        updated_at: dayjs().toISOString()
      };
      relationships.push(relationship);
    }

    return {
      id: uuidv4(),
      name: faker.lorem.words(3),
      type: 'KNOWLEDGE_GRAPH',
      metadata: {
        topic_id: uuidv4(),
        node_count: nodes.length,
        relationship_count: relationships.length,
        depth: maxDepth,
        quality_score: faker.number.float({ min: 0.8, max: 1, precision: 0.01 }),
        version: 1,
        is_validated: true,
        validation_errors: [],
        last_validation: dayjs().toISOString()
      },
      nodes,
      relationships,
      created_at: dayjs().toISOString(),
      updated_at: dayjs().toISOString()
    };
  } catch (error) {
    console.error('Error generating mock graph:', error);
    throw error;
  }
}

/**
 * Generates mock vector embeddings with configurable dimensions and similarity patterns.
 * 
 * @param count Number of vectors to generate
 * @param dimension Vector dimension (default 384)
 * @param options Vector generation options
 * @returns Array of validated mock vector embeddings
 */
@measurePerformance
export async function generateMockVectors(
  count: number,
  dimension: number = VECTOR_DIMENSION,
  options: VectorOptions = {}
): Promise<any[]> {
  const {
    seed = RANDOM_SEED,
    similarityThreshold = 0.85,
    generatePairs = true,
    includeMetadata = true
  } = options;

  faker.seed(seed);

  try {
    const vectors = [];
    const baseVector = test_vectors[0];

    for (let i = 0; i < count; i++) {
      // Generate random vector with controlled magnitude
      const vector = Array(dimension).fill(0).map(() => 
        faker.number.float({ min: -1, max: 1, precision: 0.01 })
      );
      
      // Normalize vector
      const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
      const normalizedVector = vector.map(val => val / magnitude);

      const mockVector = {
        id: uuidv4(),
        vector: normalizedVector,
        quality_score: faker.number.float({ min: 0.7, max: 1, precision: 0.01 }),
        metadata: includeMetadata ? {
          content_id: uuidv4(),
          source: faker.helpers.arrayElement(['research_paper', 'video', 'article', 'book']),
          type: faker.helpers.arrayElement(['text', 'audio', 'video']),
          timestamp: dayjs().toISOString(),
          topic: faker.lorem.word(),
          processing_time: faker.number.float({ min: 0.5, max: 3.0, precision: 0.1 }),
          source_confidence: faker.number.float({ min: 0.7, max: 1, precision: 0.01 }),
          validation_markers: {
            dimension_valid: true,
            quality_valid: true,
            metadata_complete: true
          }
        } : undefined
      };

      vectors.push(mockVector);
    }

    // Generate similar pairs if requested
    if (generatePairs) {
      const similarPairs = [];
      for (let i = 0; i < Math.min(count - 1, 5); i++) {
        const baseVector = vectors[i].vector;
        const similarVector = baseVector.map(val => 
          val + faker.number.float({ min: -0.1, max: 0.1, precision: 0.01 })
        );
        
        vectors.push({
          id: uuidv4(),
          vector: similarVector,
          quality_score: vectors[i].quality_score,
          metadata: { ...vectors[i].metadata, is_similar_pair: true }
        });

        similarPairs.push({
          vector1_id: vectors[i].id,
          vector2_id: vectors[vectors.length - 1].id,
          expected_similarity: faker.number.float({ min: similarityThreshold, max: 1, precision: 0.01 })
        });
      }
    }

    return vectors;
  } catch (error) {
    console.error('Error generating mock vectors:', error);
    throw error;
  }
}

// Helper function to generate type-specific metadata
function generateTypeSpecificMetadata(type: typeof CONTENT_TYPES[number]): any {
  switch (type) {
    case 'video':
      return {
        duration: faker.number.int({ min: 300, max: 7200 }),
        resolution: faker.helpers.arrayElement(['720p', '1080p', '4K']),
        platform: faker.helpers.arrayElement(['YouTube', 'Vimeo', 'Coursera']),
        views: faker.number.int({ min: 1000, max: 1000000 })
      };
    case 'podcast':
      return {
        duration: faker.number.int({ min: 600, max: 5400 }),
        episode_number: faker.number.int({ min: 1, max: 100 }),
        series_name: faker.company.name(),
        platform: faker.helpers.arrayElement(['Spotify', 'Apple Podcasts', 'Google Podcasts'])
      };
    case 'article':
      return {
        author: faker.person.fullName(),
        publication_date: dayjs().subtract(faker.number.int({ min: 1, max: 365 }), 'days').toISOString(),
        publisher: faker.company.name(),
        word_count: faker.number.int({ min: 500, max: 5000 })
      };
    case 'book':
      return {
        author: faker.person.fullName(),
        isbn: faker.string.numeric(13),
        publisher: faker.company.name(),
        publication_year: faker.number.int({ min: 2000, max: 2024 }),
        page_count: faker.number.int({ min: 100, max: 1000 })
      };
  }
}

// Helper function to validate content schema
function validateContentSchema(content: any): void {
  const requiredFields = [
    'id', 'topic_id', 'type', 'title', 'description', 'source_url',
    'quality_score', 'metadata', 'created_at', 'updated_at'
  ];

  for (const field of requiredFields) {
    if (!(field in content)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (!CONTENT_TYPES.includes(content.type)) {
    throw new Error(`Invalid content type: ${content.type}`);
  }

  if (content.quality_score < 0 || content.quality_score > 1) {
    throw new Error(`Invalid quality score: ${content.quality_score}`);
  }
}