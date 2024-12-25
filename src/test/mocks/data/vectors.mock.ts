// External imports with versions
import { v4 as uuid } from 'uuid'; // ^9.0.0

// Internal imports
import { generateMockVectors } from '../../utils/data-generators';

// Constants for vector configuration and validation
export const VECTOR_DIMENSION = 384;
export const MOCK_VECTOR_COUNT = 100;
export const MIN_QUALITY_SCORE = 0.9;
export const MAX_PROCESSING_TIME_MS = 5000;

// Test case categories for comprehensive coverage
export const TEST_CASE_TYPES = {
  HIGH_QUALITY: 'high_quality',
  BOUNDARY_QUALITY: 'boundary_quality',
  PROCESSING_TIME: 'processing_time',
  SIMILAR_PAIRS: 'similar_pairs',
  EDGE_CASES: 'edge_cases'
} as const;

// Interface definitions for type safety
interface MockVectorMetadata {
  content_id: string;
  source: string;
  type: string;
  timestamp: string;
  topic: string;
  processing_time: number;
  source_confidence: number;
  validation_markers: {
    dimension_valid: boolean;
    quality_valid: boolean;
    metadata_complete: boolean;
  };
  test_case?: string;
}

interface MockVector {
  id: string;
  vector: number[];
  quality_score: number;
  metadata: MockVectorMetadata;
}

interface MockVectorOptions {
  qualityScore?: number;
  processingTime?: number;
  testCase?: string;
  similarityTarget?: number[];
}

/**
 * Creates a single mock vector with comprehensive validation and metadata
 */
export function createMockVector(contentId: string, options: MockVectorOptions = {}): MockVector {
  const {
    qualityScore = Math.max(MIN_QUALITY_SCORE, Math.random() * 0.2 + 0.8),
    processingTime = Math.min(MAX_PROCESSING_TIME_MS, Math.random() * 2000 + 1000),
    testCase,
    similarityTarget
  } = options;

  // Generate base vector
  let vector: number[];
  if (similarityTarget) {
    // Create similar vector with controlled deviation
    vector = similarityTarget.map(v => 
      v + (Math.random() - 0.5) * 0.1
    );
  } else {
    // Generate random normalized vector
    vector = Array(VECTOR_DIMENSION).fill(0).map(() => 
      Math.random() * 2 - 1
    );
  }

  // Normalize vector
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  vector = vector.map(val => val / magnitude);

  return {
    id: uuid(),
    vector,
    quality_score: qualityScore,
    metadata: {
      content_id: contentId,
      source: 'research_paper',
      type: 'text',
      timestamp: new Date().toISOString(),
      topic: 'machine_learning',
      processing_time: processingTime,
      source_confidence: qualityScore * 0.95,
      validation_markers: {
        dimension_valid: vector.length === VECTOR_DIMENSION,
        quality_valid: qualityScore >= MIN_QUALITY_SCORE,
        metadata_complete: true
      },
      test_case: testCase
    }
  };
}

/**
 * Validates a mock vector against all required criteria
 */
export function validateMockVector(vector: MockVector): boolean {
  try {
    // Validate vector dimensions
    if (vector.vector.length !== VECTOR_DIMENSION) {
      return false;
    }

    // Validate vector normalization
    const magnitude = Math.sqrt(vector.vector.reduce((sum, val) => sum + val * val, 0));
    if (Math.abs(magnitude - 1.0) > 0.0001) {
      return false;
    }

    // Validate quality score
    if (vector.quality_score < MIN_QUALITY_SCORE || vector.quality_score > 1.0) {
      return false;
    }

    // Validate processing time
    if (vector.metadata.processing_time > MAX_PROCESSING_TIME_MS) {
      return false;
    }

    // Validate required metadata fields
    const requiredFields = [
      'content_id',
      'source',
      'type',
      'timestamp',
      'topic',
      'processing_time',
      'source_confidence',
      'validation_markers'
    ];

    return requiredFields.every(field => field in vector.metadata);
  } catch (error) {
    console.error('Vector validation error:', error);
    return false;
  }
}

// Generate comprehensive test vectors
export const mockVectors: MockVector[] = (() => {
  const vectors: MockVector[] = [];
  const baseVectors = generateMockVectors(MOCK_VECTOR_COUNT, VECTOR_DIMENSION);

  // High quality vectors
  vectors.push(...baseVectors.slice(0, 20).map(v => 
    createMockVector(uuid(), {
      qualityScore: 0.95,
      testCase: TEST_CASE_TYPES.HIGH_QUALITY
    })
  ));

  // Boundary quality vectors
  vectors.push(...baseVectors.slice(20, 40).map(v =>
    createMockVector(uuid(), {
      qualityScore: MIN_QUALITY_SCORE,
      testCase: TEST_CASE_TYPES.BOUNDARY_QUALITY
    })
  ));

  // Processing time test vectors
  vectors.push(...baseVectors.slice(40, 60).map(v =>
    createMockVector(uuid(), {
      processingTime: MAX_PROCESSING_TIME_MS * 0.9,
      testCase: TEST_CASE_TYPES.PROCESSING_TIME
    })
  ));

  // Similar vector pairs
  const similarityTargets = baseVectors.slice(60, 70);
  similarityTargets.forEach(target => {
    const original = createMockVector(uuid(), {
      testCase: TEST_CASE_TYPES.SIMILAR_PAIRS
    });
    vectors.push(original);
    vectors.push(createMockVector(uuid(), {
      similarityTarget: original.vector,
      testCase: TEST_CASE_TYPES.SIMILAR_PAIRS
    }));
  });

  // Edge cases
  vectors.push(
    createMockVector(uuid(), {
      qualityScore: 0.901, // Just above threshold
      processingTime: MAX_PROCESSING_TIME_MS - 1, // Just under limit
      testCase: TEST_CASE_TYPES.EDGE_CASES
    })
  );

  return vectors.filter(validateMockVector);
})();

// Export test case pairs for similarity testing
export const similarPairs = mockVectors
  .filter(v => v.metadata.test_case === TEST_CASE_TYPES.SIMILAR_PAIRS)
  .reduce((pairs, v, i, arr) => {
    if (i % 2 === 0) {
      pairs.push({
        vector1: v,
        vector2: arr[i + 1],
        expectedSimilarity: 0.9
      });
    }
    return pairs;
  }, [] as Array<{
    vector1: MockVector;
    vector2: MockVector;
    expectedSimilarity: number;
  }>);