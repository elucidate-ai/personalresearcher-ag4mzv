// k6 v0.45.0 - Load testing framework
import { check, sleep } from 'k6';  
import http from 'k6/http';  

// Base configuration
const BASE_URL = 'http://vector-service:8080';
const VECTOR_DIMENSIONS = 768;
const DEFAULT_TOP_K = 10;
const SIMILARITY_THRESHOLD = 0.7;
const RAMP_UP_TIME = '30s';
const STEADY_STATE_TIME = '5m';
const RAMP_DOWN_TIME = '30s';

// Test configuration options
export const options = {
  stages: [
    { duration: RAMP_UP_TIME, target: 50 },    // Ramp up to 50 VUs
    { duration: STEADY_STATE_TIME, target: 50 }, // Stay at 50 VUs
    { duration: RAMP_DOWN_TIME, target: 0 }     // Ramp down to 0 VUs
  ],
  thresholds: {
    // Performance criteria based on requirements
    'http_req_duration': ['p95<5000'], // 95% of requests should complete within 5s
    'http_req_failed': ['rate<0.001'],  // Error rate < 0.1% for 99.9% availability
    'checks': ['rate>0.99'],            // 99% of checks should pass
  },
  // Test-wide settings
  noConnectionReuse: false,
  userAgent: 'K6VectorSearchLoadTest/1.0',
};

/**
 * Generates a random normalized vector for search testing
 * @param {number} dimensions - Vector dimensionality (must match VECTOR_DIMENSIONS)
 * @returns {Array<number>} Normalized random vector
 */
function generateRandomVector(dimensions) {
  if (dimensions !== VECTOR_DIMENSIONS) {
    throw new Error(`Vector dimensions must be ${VECTOR_DIMENSIONS}`);
  }

  const vector = new Array(dimensions);
  let magnitude = 0;

  // Generate random components
  for (let i = 0; i < dimensions; i++) {
    vector[i] = Math.random() * 2 - 1; // Random value between -1 and 1
    magnitude += vector[i] * vector[i];
  }

  // Normalize to unit length
  magnitude = Math.sqrt(magnitude);
  for (let i = 0; i < dimensions; i++) {
    vector[i] = vector[i] / magnitude;
  }

  return vector;
}

/**
 * Test setup function to initialize test data and configuration
 */
export function setup() {
  // Verify service availability before starting tests
  const healthCheck = http.get(`${BASE_URL}/health`);
  check(healthCheck, {
    'vector service is available': (r) => r.status === 200,
  });

  return {
    testVectors: [
      generateRandomVector(VECTOR_DIMENSIONS),
      generateRandomVector(VECTOR_DIMENSIONS),
      generateRandomVector(VECTOR_DIMENSIONS)
    ],
    searchParams: {
      topK: DEFAULT_TOP_K,
      similarityThreshold: SIMILARITY_THRESHOLD
    }
  };
}

/**
 * Main test function for vector similarity search
 */
export default function() {
  const testData = setup();
  const queryVector = generateRandomVector(VECTOR_DIMENSIONS);

  // Construct search request payload
  const payload = JSON.stringify({
    query_vector: queryVector,
    top_k: testData.searchParams.topK,
    similarity_threshold: testData.searchParams.similarityThreshold
  });

  // Request headers
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  // Execute search request
  const response = http.post(
    `${BASE_URL}/v1/search`,
    payload,
    { headers }
  );

  // Validate response
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response has results array': (r) => Array.isArray(r.json().results),
    'results length <= top_k': (r) => r.json().results.length <= testData.searchParams.topK,
    'response time < 5s': (r) => r.timings.duration < 5000,
    'has total_found field': (r) => typeof r.json().total_found === 'number'
  });

  // Validate similarity scores
  if (response.status === 200) {
    const results = response.json().results;
    check(results, {
      'all similarity scores >= threshold': (r) => 
        r.every(item => item.similarity_score >= testData.searchParams.similarityThreshold),
      'similarity scores are descending': (r) =>
        r.every((item, i) => i === 0 || item.similarity_score <= r[i-1].similarity_score)
    });
  }

  // Record custom metrics
  if (response.status === 200) {
    const results = response.json().results;
    const avgSimilarity = results.reduce((sum, r) => sum + r.similarity_score, 0) / results.length;
    
    // Add custom metrics
    response.metrics.add('vector_search_results_count', results.length);
    response.metrics.add('vector_search_avg_similarity', avgSimilarity);
  }

  // Implement think time between requests
  sleep(1);
}