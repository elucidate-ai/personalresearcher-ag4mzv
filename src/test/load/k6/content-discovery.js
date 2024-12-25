// k6 v0.45.0 imports
import http from 'k6/http';  
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Base configuration
const BASE_URL = 'http://localhost:3000/api/v1';

// Load test stages configuration
export const options = {
  stages: [
    { duration: '1m', target: 50 },  // Ramp up to 50 users
    { duration: '3m', target: 100 }, // Stress test with 100 users
    { duration: '1m', target: 0 }    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],     // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.01'],       // Less than 1% failure rate
    http_reqs: ['rate>100'],              // Maintain >100 RPS
    content_quality_score: ['avg>0.9']     // Maintain 90% quality score
  },
  setupTimeout: '1m'
};

// Custom metrics for detailed performance analysis
const customMetrics = {
  contentQualityScore: new Rate('Content Quality Score'),
  processingTime: new Rate('Processing Time'),
  sourceCount: new Rate('Source Count')
};

// Test setup function
export function setup() {
  // Initialize test data
  const testTopics = [
    'machine_learning',
    'quantum_computing',
    'artificial_intelligence',
    'blockchain'
  ];

  // Generate authentication tokens
  const authTokens = {
    basic: 'Bearer basic-user-token',
    premium: 'Bearer premium-user-token'
  };

  // Test content types
  const contentTypes = {
    video: { source: 'youtube', weight: 0.4 },
    article: { source: 'web', weight: 0.3 },
    podcast: { source: 'spotify', weight: 0.3 }
  };

  // Rate limiting configuration
  const rateLimits = {
    requestsPerHour: 1000,
    burstCapacity: 50
  };

  return {
    topics: testTopics,
    auth: authTokens,
    content: contentTypes,
    rateLimits
  };
}

// Content discovery endpoint test
function handleDiscoverContent(testData) {
  const payload = {
    topic: testData.topics[Math.floor(Math.random() * testData.topics.length)],
    filters: {
      contentTypes: ['video', 'article', 'podcast'],
      qualityThreshold: 0.9,
      maxResults: 10
    }
  };

  const headers = {
    'Authorization': testData.auth.premium,
    'Content-Type': 'application/json'
  };

  const response = http.post(
    `${BASE_URL}/content/discover`,
    JSON.stringify(payload),
    { headers }
  );

  // Comprehensive response validation
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response has content': (r) => r.json().content.length > 0,
    'content quality meets threshold': (r) => {
      const content = r.json().content;
      return content.every(item => item.qualityScore >= 0.9);
    },
    'processing time within limits': (r) => {
      const processingTime = r.timings.duration;
      customMetrics.processingTime.add(processingTime < 5000);
      return processingTime < 5000;
    },
    'source diversity maintained': (r) => {
      const sources = new Set(r.json().content.map(item => item.source));
      customMetrics.sourceCount.add(sources.size >= 3);
      return sources.size >= 3;
    }
  });

  // Rate limit validation
  check(response.headers, {
    'rate limit headers present': (h) => h['X-RateLimit-Remaining'] !== undefined,
    'rate limit not exceeded': (h) => parseInt(h['X-RateLimit-Remaining']) > 0
  });
}

// Quality assessment endpoint test
function handleQualityAssessment(testData) {
  const payload = {
    content: {
      id: `test-content-${Date.now()}`,
      type: 'article',
      source: 'web',
      data: {
        title: 'Test Article',
        body: 'Comprehensive test content for quality assessment',
        metadata: {
          author: 'Test Author',
          publishDate: new Date().toISOString()
        }
      }
    }
  };

  const headers = {
    'Authorization': testData.auth.basic,
    'Content-Type': 'application/json'
  };

  const response = http.post(
    `${BASE_URL}/content/assess`,
    JSON.stringify(payload),
    { headers }
  );

  // Quality assessment validation
  check(response, {
    'status is 200': (r) => r.status === 200,
    'quality score present': (r) => r.json().qualityScore !== undefined,
    'quality score above threshold': (r) => {
      const score = r.json().qualityScore;
      customMetrics.contentQualityScore.add(score >= 0.9);
      return score >= 0.9;
    },
    'assessment criteria complete': (r) => {
      const criteria = r.json().assessmentCriteria;
      return criteria && Object.keys(criteria).length >= 5;
    }
  });
}

// Default test function
export default function(testData) {
  // Random test scenario selection
  const scenario = Math.random();
  
  // Apply rate limiting
  const requestDelay = 3600 / testData.rateLimits.requestsPerHour;
  
  if (scenario < 0.7) {
    // 70% content discovery tests
    handleDiscoverContent(testData);
  } else {
    // 30% quality assessment tests
    handleQualityAssessment(testData);
  }

  // Dynamic sleep to maintain rate limits
  sleep(requestDelay);
}