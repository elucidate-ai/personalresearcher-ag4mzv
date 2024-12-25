// External imports
// k6/http v0.40.0
import http from 'k6/http';
// k6 v0.40.0
import { check } from 'k6';
// k6 v0.40.0
import { sleep } from 'k6';

// Global constants
const BASE_URL = 'http://api-gateway:3000';
const EXPORT_ENDPOINT = '/api/v1/export';
const EXPORT_STATUS_ENDPOINT = '/api/v1/export/:id/status';
const EXPORT_FORMATS = [
  { type: 'notion' },
  { type: 'markdown' },
  { type: 'pdf' }
];

// Test configuration
export const options = {
  scenarios: {
    constant_load: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
    },
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '5m', target: 50 },
        { duration: '2m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.95'],
    export_completion_time: ['p(90)<30000'],
  },
};

// Test setup function
export function setup() {
  // Generate test auth token
  const authToken = 'test-auth-token'; // In real implementation, get from auth service

  // Prepare sample topics with varying complexity
  const sampleTopics = [
    {
      id: 'topic1',
      name: 'Machine Learning Basics',
      complexity: 'low',
    },
    {
      id: 'topic2',
      name: 'Advanced Neural Networks',
      complexity: 'high',
    },
    {
      id: 'topic3',
      name: 'Data Science Fundamentals',
      complexity: 'medium',
    },
  ];

  return {
    authToken,
    topics: sampleTopics,
  };
}

// Main test function
export default function(data) {
  // Select random topic and export format
  const topic = data.topics[Math.floor(Math.random() * data.topics.length)];
  const format = EXPORT_FORMATS[Math.floor(Math.random() * EXPORT_FORMATS.length)];

  // Initiate export
  const exportResponse = initiateExport({ topic, format }, data.authToken);
  
  // Validate export initiation
  check(exportResponse, {
    'Export request successful': (r) => r.status === 200,
    'Export job ID returned': (r) => r.json().exportId !== undefined,
  });

  if (!exportResponse.json().exportId) {
    console.error('Failed to initiate export');
    return;
  }

  // Poll export status
  const exportId = exportResponse.json().exportId;
  let status = null;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    status = checkExportStatus(exportId, data.authToken);
    
    check(status, {
      'Export completed successfully': (s) => s.completed === true,
      'Export URL valid': (s) => s.result?.url !== undefined,
      'Export format correct': (s) => s.result?.format === format.type,
    });

    if (status.completed) {
      break;
    }

    // Exponential backoff
    sleep(Math.min(1 * Math.pow(2, attempts), 10));
    attempts++;
  }

  // Add think time between iterations
  sleep(Math.random() * 3 + 2); // 2-5 seconds
}

// Helper function to initiate export
function initiateExport(exportOptions, authToken) {
  const payload = JSON.stringify({
    topicId: exportOptions.topic.id,
    format: exportOptions.format.type,
    options: {
      includeReferences: true,
      includeMetadata: true,
      quality: 'high',
    },
  });

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  };

  const response = http.post(
    `${BASE_URL}${EXPORT_ENDPOINT}`,
    payload,
    { headers }
  );

  return response;
}

// Helper function to check export status
function checkExportStatus(exportId, authToken) {
  const headers = {
    'Authorization': `Bearer ${authToken}`,
  };

  const statusUrl = `${BASE_URL}${EXPORT_STATUS_ENDPOINT}`.replace(':id', exportId);
  const response = http.get(statusUrl, { headers });

  if (response.status !== 200) {
    console.error(`Failed to check export status: ${response.status}`);
    return { completed: false };
  }

  return response.json();
}