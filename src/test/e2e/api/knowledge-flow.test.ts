// External imports with versions
import { jest } from '@jest/globals'; // v29.x
import now from 'performance-now'; // v2.x

// Internal imports
import { TestClient } from '../../utils/test-client';
import { setupTestEnvironment } from '../../utils/test-helpers';
import { graphs } from '../../fixtures/graphs.json';

// Constants for test configuration
const TEST_TIMEOUT = 60000; // 60 seconds
const PERFORMANCE_THRESHOLD = 5000; // 5 seconds
const MIN_CONNECTIONS = 10; // Minimum required connections per topic

describe('Knowledge Graph Flow', () => {
    let client: TestClient;
    let testGraphId: string;
    let startTime: number;

    beforeAll(async () => {
        // Initialize test environment with monitoring
        await setupTestEnvironment({
            mockData: true,
            timeoutMs: TEST_TIMEOUT
        });
        client = new TestClient();
    });

    beforeEach(() => {
        startTime = now();
    });

    afterEach(() => {
        const duration = now() - startTime;
        if (duration > PERFORMANCE_THRESHOLD) {
            console.warn(`Test execution exceeded threshold: ${duration.toFixed(2)}ms`);
        }
    });

    afterAll(async () => {
        // Cleanup test data and close connections
        if (testGraphId) {
            await client.delete(`/api/v1/graphs/${testGraphId}`);
        }
        await client.cleanup();
    });

    describe('Graph Creation', () => {
        it('should create a new knowledge graph with complete validation', async () => {
            const mockGraph = graphs[0];
            const response = await client.post('/api/v1/graphs', {
                topic_id: mockGraph.metadata.topic_id,
                metadata: {
                    name: 'Machine Learning Knowledge Graph',
                    description: 'Comprehensive ML knowledge structure',
                    source: 'e2e-test'
                }
            });

            expect(response.success).toBe(true);
            expect(response.data).toHaveProperty('id');
            expect(response.data.nodes).toHaveLength(mockGraph.nodes.length);
            expect(response.data.relationships).toHaveLength(mockGraph.relationships.length);
            
            // Validate graph complexity requirements
            expect(response.data.metadata.node_count).toBeGreaterThanOrEqual(MIN_CONNECTIONS);
            expect(response.data.metadata.relationship_count).toBeGreaterThanOrEqual(MIN_CONNECTIONS);
            
            testGraphId = response.data.id;
        }, TEST_TIMEOUT);

        it('should validate node importance scores and relationship weights', async () => {
            const response = await client.get(`/api/v1/graphs/${testGraphId}`);
            
            expect(response.success).toBe(true);
            
            // Validate node importance scores
            response.data.nodes.forEach(node => {
                expect(node.importance_score).toBeGreaterThanOrEqual(0);
                expect(node.importance_score).toBeLessThanOrEqual(1);
            });

            // Validate relationship weights
            response.data.relationships.forEach(rel => {
                expect(rel.weight).toBeGreaterThanOrEqual(0);
                expect(rel.weight).toBeLessThanOrEqual(1);
            });
        });

        it('should enforce minimum connection requirements', async () => {
            const response = await client.get(`/api/v1/graphs/${testGraphId}/metrics`);
            
            expect(response.success).toBe(true);
            expect(response.data.average_node_connections).toBeGreaterThanOrEqual(MIN_CONNECTIONS);
            expect(response.data.graph_density).toBeGreaterThan(0);
        });
    });

    describe('Graph Retrieval and Analysis', () => {
        it('should retrieve graph with complete metadata', async () => {
            const response = await client.get(`/api/v1/graphs/${testGraphId}`);
            
            expect(response.success).toBe(true);
            expect(response.data).toMatchObject({
                id: testGraphId,
                metadata: expect.objectContaining({
                    node_count: expect.any(Number),
                    relationship_count: expect.any(Number),
                    created_at: expect.any(String),
                    updated_at: expect.any(String)
                })
            });
        });

        it('should analyze graph complexity and structure', async () => {
            const response = await client.get(`/api/v1/graphs/${testGraphId}/analysis`, {
                params: {
                    metrics: ['centrality', 'clustering', 'density']
                }
            });
            
            expect(response.success).toBe(true);
            expect(response.data).toHaveProperty('centrality_metrics');
            expect(response.data).toHaveProperty('clustering_coefficient');
            expect(response.data).toHaveProperty('graph_density');
        });

        it('should validate graph integrity and relationships', async () => {
            const response = await client.post(`/api/v1/graphs/${testGraphId}/validate`);
            
            expect(response.success).toBe(true);
            expect(response.data).toMatchObject({
                is_valid: true,
                validation_details: expect.any(Object)
            });
        });
    });

    describe('Graph Updates and Relationship Management', () => {
        it('should add new nodes with proper validation', async () => {
            const newNode = {
                label: 'Deep Learning',
                type: 'CORE_CONCEPT',
                properties: {
                    description: 'Advanced neural network architectures',
                    importance_score: 0.95
                }
            };

            const response = await client.post(`/api/v1/graphs/${testGraphId}/nodes`, newNode);
            
            expect(response.success).toBe(true);
            expect(response.data).toHaveProperty('id');
            expect(response.data.importance_score).toBeGreaterThanOrEqual(0.9);
        });

        it('should create relationships with weight validation', async () => {
            const nodes = (await client.get(`/api/v1/graphs/${testGraphId}/nodes`)).data;
            
            const newRelationship = {
                source_node_id: nodes[0].id,
                target_node_id: nodes[1].id,
                type: 'RELATES_TO',
                weight: 0.85,
                metadata: {
                    confidence_score: 0.9
                }
            };

            const response = await client.post(
                `/api/v1/graphs/${testGraphId}/relationships`, 
                newRelationship
            );
            
            expect(response.success).toBe(true);
            expect(response.data).toHaveProperty('id');
            expect(response.data.weight).toBeGreaterThanOrEqual(0.8);
        });

        it('should update graph structure with version control', async () => {
            const updateData = {
                metadata: {
                    version: 2,
                    last_updated_by: 'e2e-test'
                }
            };

            const response = await client.put(`/api/v1/graphs/${testGraphId}`, updateData);
            
            expect(response.success).toBe(true);
            expect(response.data.metadata.version).toBe(2);
            expect(response.data.metadata.last_updated_by).toBe('e2e-test');
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle invalid graph operations gracefully', async () => {
            const response = await client.post('/api/v1/graphs', {
                topic_id: 'invalid-id'
            });
            
            expect(response.success).toBe(false);
            expect(response.error).toBeDefined();
        });

        it('should validate relationship cycles and constraints', async () => {
            const nodes = (await client.get(`/api/v1/graphs/${testGraphId}/nodes`)).data;
            
            const cyclicRelationship = {
                source_node_id: nodes[0].id,
                target_node_id: nodes[0].id,
                type: 'RELATES_TO',
                weight: 0.5
            };

            const response = await client.post(
                `/api/v1/graphs/${testGraphId}/relationships`, 
                cyclicRelationship
            );
            
            expect(response.success).toBe(false);
            expect(response.error).toContain('cyclic relationship');
        });

        it('should handle concurrent graph updates', async () => {
            const updates = Array(5).fill(null).map((_, i) => ({
                metadata: {
                    version: i + 3,
                    last_updated_by: `concurrent-${i}`
                }
            }));

            const responses = await Promise.all(
                updates.map(update => 
                    client.put(`/api/v1/graphs/${testGraphId}`, update)
                )
            );

            // Verify only one update succeeded
            const successCount = responses.filter(r => r.success).length;
            expect(successCount).toBe(1);
        });
    });
});