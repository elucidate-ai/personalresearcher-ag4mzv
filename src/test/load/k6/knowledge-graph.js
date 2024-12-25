// External imports with versions
import http from 'k6/http'; // v0.45.0 - HTTP request handling
import { check } from 'k6'; // v0.45.0 - Response validation
import { sleep } from 'k6'; // v0.45.0 - Think time simulation

// Base configuration
const BASE_URL = 'http://localhost:8000/api/v1/knowledge';
const THINK_TIME = { min: 0.5, max: 2.0 };

// Test configuration
export const options = {
    stages: [
        { duration: '1m', target: 10 },  // Ramp-up
        { duration: '3m', target: 50 },  // Sustained load
        { duration: '2m', target: 100 }, // Peak load
        { duration: '1m', target: 0 }    // Ramp-down
    ],
    thresholds: {
        http_req_duration: ['p(95)<5000', 'p(99)<7500'], // 5s/7.5s thresholds
        http_req_failed: ['rate<0.01'],                   // 99.9% success rate
        graph_complexity: ['min>=10'],                    // Min connections per topic
        iteration_duration: ['p(90)<30000']               // Overall performance
    },
    userAgent: 'k6-knowledge-graph-test/1.0',
    maxRedirects: 0,
    noConnectionReuse: true,
    batchPerHost: 6
};

// Test data setup
export function setup() {
    const testData = {
        topics: [
            {
                name: 'Machine Learning',
                complexity: 'high',
                expectedConnections: 15
            },
            {
                name: 'Data Science',
                complexity: 'medium',
                expectedConnections: 12
            },
            {
                name: 'Neural Networks',
                complexity: 'high',
                expectedConnections: 18
            }
        ],
        nodeTemplates: {
            concept: { type: 'concept', weight: 1.0 },
            prerequisite: { type: 'prerequisite', weight: 0.8 },
            related: { type: 'related', weight: 0.6 }
        },
        relationshipPatterns: [
            { source: 'concept', target: 'prerequisite', minCount: 3 },
            { source: 'concept', target: 'related', minCount: 7 }
        ]
    };

    // Validate test environment
    const healthCheck = http.get(`${BASE_URL}/health`);
    check(healthCheck, {
        'API health check passed': (r) => r.status === 200
    });

    return testData;
}

// Graph creation with validation
function createGraph(testData) {
    const payload = {
        topic: testData.topics[Math.floor(Math.random() * testData.topics.length)],
        nodeTemplate: testData.nodeTemplates.concept,
        relationships: testData.relationshipPatterns
    };

    const params = {
        headers: {
            'Content-Type': 'application/json',
            'X-Test-ID': `create-${Date.now()}`,
            'X-Request-Priority': 'high'
        },
        timeout: '10s'
    };

    const response = http.post(`${BASE_URL}/graphs`, JSON.stringify(payload), params);

    check(response, {
        'Graph creation successful': (r) => r.status === 201,
        'Response contains graph ID': (r) => r.json('id') !== undefined,
        'Minimum connections present': (r) => r.json('connections').length >= 10
    });

    return response.json();
}

// Graph retrieval with validation
function getGraph(graphId) {
    const params = {
        headers: {
            'X-Test-ID': `get-${Date.now()}`,
            'Cache-Control': 'no-cache'
        },
        timeout: '5s'
    };

    const response = http.get(`${BASE_URL}/graphs/${graphId}`, params);

    check(response, {
        'Graph retrieval successful': (r) => r.status === 200,
        'Graph structure valid': (r) => r.json('nodes').length > 0,
        'Graph relationships valid': (r) => r.json('relationships').length >= 10
    });

    return response.json();
}

// Graph update with validation
function updateGraph(graphId, updateData) {
    const params = {
        headers: {
            'Content-Type': 'application/json',
            'X-Test-ID': `update-${Date.now()}`,
            'X-Change-Type': 'incremental'
        },
        timeout: '7s'
    };

    const response = http.put(
        `${BASE_URL}/graphs/${graphId}`,
        JSON.stringify(updateData),
        params
    );

    check(response, {
        'Graph update successful': (r) => r.status === 200,
        'Update changes applied': (r) => r.json('modified') === true,
        'Graph integrity maintained': (r) => r.json('relationships').length >= 10
    });

    return response.json();
}

// Relationship retrieval and validation
function getRelationships(graphId, nodeId) {
    const params = {
        headers: {
            'X-Test-ID': `rel-${Date.now()}`,
            'X-Depth-Level': '2'
        },
        timeout: '5s'
    };

    const response = http.get(
        `${BASE_URL}/graphs/${graphId}/nodes/${nodeId}/relationships`,
        params
    );

    check(response, {
        'Relationship retrieval successful': (r) => r.status === 200,
        'Minimum relationships present': (r) => r.json('relationships').length >= 3,
        'Relationship data complete': (r) => r.json('metadata') !== undefined
    });

    return response.json();
}

// Main test execution
export default function(testData) {
    // Initialize test iteration
    const iterationStart = Date.now();
    let graphId, nodeId;

    try {
        // Create new graph
        const graphData = createGraph(testData);
        graphId = graphData.id;
        nodeId = graphData.nodes[0].id;

        // Retrieve graph
        const retrievedGraph = getGraph(graphId);

        // Update graph
        const updateData = {
            addNodes: [{ type: 'related', label: 'New Concept' }],
            addRelationships: [{ source: nodeId, target: 'new', type: 'related' }]
        };
        updateGraph(graphId, updateData);

        // Get relationships
        getRelationships(graphId, nodeId);

        // Record custom metrics
        const iterationDuration = Date.now() - iterationStart;
        const graphComplexity = retrievedGraph.relationships.length;

        // Add custom metrics
        k6.metrics.add('iteration_duration', iterationDuration);
        k6.metrics.add('graph_complexity', graphComplexity);

    } catch (error) {
        console.error(`Test iteration failed: ${error.message}`);
        // Mark iteration as failed in metrics
        k6.metrics.add('iteration_failed', 1);
    }

    // Apply variable think time
    sleep(THINK_TIME.min + Math.random() * (THINK_TIME.max - THINK_TIME.min));
}