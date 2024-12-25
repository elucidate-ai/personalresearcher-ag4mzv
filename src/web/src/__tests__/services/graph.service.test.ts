import { jest } from '@jest/globals';
import { GraphService } from '../../services/graph.service';
import { graphApi } from '../../lib/api/graph.api';
import { MockFactory } from '../../../test/utils/mock-factory';
import { IGraphData, NodeType, RelationshipType } from '../../types/graph.types';

// Mock the graph API
jest.mock('../../lib/api/graph.api');
jest.mock('../../utils/graph.utils');

describe('GraphService', () => {
    let graphService: GraphService;
    let mockGraphData: IGraphData;
    let mockGraphParams: any;
    let mockSubscriber: jest.Mock;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Initialize service with test configuration
        graphService = new GraphService({
            width: 800,
            height: 600,
            antialias: true,
            alpha: true
        });

        // Initialize mock data
        mockGraphData = MockFactory.createMockGraphData();
        mockGraphParams = MockFactory.createMockGraphParams();
        mockSubscriber = jest.fn();

        // Setup API response mocks
        jest.spyOn(graphApi, 'generateGraph').mockResolvedValue({
            data: mockGraphData,
            status: 200,
            message: 'Success',
            timestamp: new Date().toISOString(),
            requestId: 'test-request-id'
        });

        jest.spyOn(graphApi, 'getGraph').mockResolvedValue({
            data: mockGraphData,
            status: 200,
            message: 'Success',
            timestamp: new Date().toISOString(),
            requestId: 'test-request-id'
        });

        jest.spyOn(graphApi, 'updateGraph').mockResolvedValue({
            data: mockGraphData,
            status: 200,
            message: 'Success',
            timestamp: new Date().toISOString(),
            requestId: 'test-request-id'
        });
    });

    afterEach(() => {
        // Clean up subscriptions and cache
        graphService.destroy();
    });

    describe('generateGraph', () => {
        it('should generate graph successfully with proper caching', async () => {
            // Setup test parameters
            const topicId = 'test-topic-123';
            const options = {
                depth: 3,
                maxNodes: 100,
                includeRelated: true,
                qualityThreshold: 0.9,
                progressive: false
            };

            // Execute graph generation
            const result = await graphService.generateGraph(topicId, options);

            // Verify API call
            expect(graphApi.generateGraph).toHaveBeenCalledWith(topicId, {
                depth: options.depth,
                maxNodes: options.maxNodes,
                includeRelated: options.includeRelated,
                qualityThreshold: options.qualityThreshold
            });

            // Verify graph state updated
            expect(graphService.getGraphState().value).toEqual(mockGraphData);

            // Verify result structure
            expect(result).toEqual(mockGraphData);
            expect(result.nodes.length).toBeGreaterThan(0);
            expect(result.relationships.length).toBeGreaterThan(0);
        });

        it('should handle graph generation errors gracefully', async () => {
            // Mock API error
            const errorMessage = 'Failed to generate graph';
            jest.spyOn(graphApi, 'generateGraph').mockRejectedValue(new Error(errorMessage));

            // Attempt graph generation
            await expect(graphService.generateGraph('test-topic', {}))
                .rejects.toThrow(errorMessage);

            // Verify error handling
            expect(graphService.getGraphState().value).toBeNull();
        });
    });

    describe('getGraph', () => {
        it('should retrieve cached graph data when available', async () => {
            // Setup cached data
            await graphService.generateGraph('test-topic', {});
            const cachedData = mockGraphData;

            // Retrieve graph
            const result = await graphService.getGraph('test-topic');

            // Verify cache hit
            expect(graphApi.getGraph).not.toHaveBeenCalled();
            expect(result).toEqual(cachedData);
        });

        it('should fetch from API when cache is empty', async () => {
            // Clear cache
            graphService.clearCache();

            // Retrieve graph
            const result = await graphService.getGraph('test-topic');

            // Verify API call
            expect(graphApi.getGraph).toHaveBeenCalledWith('test-topic');
            expect(result).toEqual(mockGraphData);
        });
    });

    describe('updateGraph', () => {
        it('should update graph with new data and notify subscribers', async () => {
            // Setup initial graph
            await graphService.generateGraph('test-topic', {});

            // Setup subscriber
            const subscriber = jest.fn();
            graphService.subscribeToGraphUpdates(subscriber);

            // Prepare update data
            const updates = {
                nodes: [
                    {
                        id: 'new-node-1',
                        label: 'New Node',
                        type: NodeType.CORE_CONCEPT,
                        importance: 0.9,
                        properties: {},
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                ],
                relationships: []
            };

            // Execute update
            await graphService.updateGraph('test-topic', updates);

            // Verify API call
            expect(graphApi.updateGraph).toHaveBeenCalledWith('test-topic', updates, {
                mergeStrategy: 'smart',
                validateRelationships: true
            });

            // Verify subscriber notification
            expect(subscriber).toHaveBeenCalledWith(mockGraphData);
        });
    });

    describe('subscribeToGraphUpdates', () => {
        it('should handle multiple subscribers with proper cleanup', async () => {
            // Setup subscribers
            const subscriber1 = jest.fn();
            const subscriber2 = jest.fn();

            // Subscribe to updates
            const unsubscribe1 = graphService.subscribeToGraphUpdates(subscriber1);
            const unsubscribe2 = graphService.subscribeToGraphUpdates(subscriber2);

            // Generate graph update
            await graphService.generateGraph('test-topic', {});

            // Verify both subscribers notified
            expect(subscriber1).toHaveBeenCalledWith(mockGraphData);
            expect(subscriber2).toHaveBeenCalledWith(mockGraphData);

            // Unsubscribe first subscriber
            unsubscribe1();

            // Generate another update
            await graphService.generateGraph('test-topic-2', {});

            // Verify only second subscriber notified
            expect(subscriber1).toHaveBeenCalledTimes(1);
            expect(subscriber2).toHaveBeenCalledTimes(2);

            // Clean up remaining subscription
            unsubscribe2();
        });

        it('should handle subscriber errors without affecting other subscribers', async () => {
            // Setup subscribers
            const errorSubscriber = jest.fn().mockImplementation(() => {
                throw new Error('Subscriber error');
            });
            const validSubscriber = jest.fn();

            // Subscribe both
            graphService.subscribeToGraphUpdates(errorSubscriber);
            graphService.subscribeToGraphUpdates(validSubscriber);

            // Generate update
            await graphService.generateGraph('test-topic', {});

            // Verify valid subscriber still receives updates
            expect(validSubscriber).toHaveBeenCalledWith(mockGraphData);
        });
    });
});