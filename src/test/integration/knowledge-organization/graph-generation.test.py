"""
Integration tests for knowledge graph generation functionality.
Validates graph building, relationship extraction, optimization, and database interactions.

Version: 1.0.0
"""

import pytest
import asyncio
from typing import Dict, List, Any
from datetime import datetime, timezone

from ../../utils.python.test_helpers import TestBase, load_test_data
from backend.knowledge-organization.app.core.graph_builder import GraphBuilder
from backend.knowledge-organization.app.models.graph import Graph, GraphValidationError
from backend.knowledge-organization.app.models.node import Node
from backend.knowledge-organization.app.models.relationship import Relationship
from backend.knowledge-organization.app.core.relationship_extractor import RelationshipExtractor
from backend.knowledge-organization.app.core.graph_optimizer import GraphOptimizer

# Test constants
TEST_GRAPH_NAME = "Test Knowledge Graph"
MIN_CONNECTIONS_PER_NODE = 10
TEST_TIMEOUT = 30
OPTIMIZATION_THRESHOLD = 0.8

@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.timeout(TEST_TIMEOUT)
class TestGraphGeneration(TestBase):
    """
    Integration test suite for knowledge graph generation functionality.
    Tests graph building, optimization, and database interactions.
    """

    def __init__(self):
        """Initialize test suite with required components."""
        super().__init__()
        self._test_graphs = load_test_data("graphs")
        self._graph_builder = None
        self._db_connection = None

    async def setup_method(self, method):
        """Set up test environment before each test."""
        await super().setup_method(method)
        
        # Initialize components
        relationship_extractor = RelationshipExtractor()
        graph_optimizer = GraphOptimizer(
            db_conn=self._db_connection,
            optimization_config={"min_clustering": 0.3}
        )
        
        self._graph_builder = GraphBuilder(
            relationship_extractor=relationship_extractor,
            graph_optimizer=graph_optimizer
        )
        
        # Setup test database
        await self.setup_test_db()

    async def test_graph_generation_with_valid_nodes(self):
        """Test successful graph generation with valid input nodes."""
        try:
            # Load test nodes
            valid_nodes = self._test_graphs["valid_graphs"][0]["nodes"]
            
            # Generate graph
            graph = await self._graph_builder.build_graph(
                nodes=valid_nodes,
                graph_name=TEST_GRAPH_NAME
            )
            
            # Validate graph structure
            assert isinstance(graph, Graph)
            assert graph.name == TEST_GRAPH_NAME
            assert len(graph.nodes) == len(valid_nodes)
            
            # Verify minimum connections requirement
            node_connections = await graph.analyze_subgraph(
                root_node_id=graph.nodes[0].id,
                metrics=["centrality"]
            )
            assert all(
                degree >= MIN_CONNECTIONS_PER_NODE 
                for degree in node_connections["centrality"].values()
            )
            
            # Validate database persistence
            stored_graph = await self._db_connection.execute_query(
                "MATCH (n:Node) RETURN count(n) as node_count"
            )
            assert stored_graph[0]["node_count"] == len(valid_nodes)
            
            self.logger.info(
                "Graph generation test passed",
                extra={
                    "graph_id": graph.id,
                    "node_count": len(graph.nodes),
                    "relationship_count": len(graph.relationships)
                }
            )

        except Exception as e:
            self.logger.error(f"Graph generation test failed: {str(e)}")
            raise

    async def test_graph_optimization(self):
        """Test graph optimization process and quality improvements."""
        try:
            # Load optimization test data
            optimization_graph = self._test_graphs["optimization_graphs"][0]
            
            # Generate initial graph
            initial_graph = await self._graph_builder.build_graph(
                nodes=optimization_graph["nodes"],
                graph_name=TEST_GRAPH_NAME
            )
            
            # Record pre-optimization metrics
            pre_metrics = await initial_graph.analyze_subgraph(
                root_node_id=initial_graph.nodes[0].id,
                metrics=["centrality", "communities"]
            )
            
            # Perform optimization
            optimized_graph = await self._graph_builder._graph_optimizer.optimize(
                initial_graph
            )
            
            # Validate optimization improvements
            post_metrics = await optimized_graph.analyze_subgraph(
                root_node_id=optimized_graph.nodes[0].id,
                metrics=["centrality", "communities"]
            )
            
            # Assert optimization threshold met
            assert (
                post_metrics["average_clustering"] / pre_metrics["average_clustering"]
                >= OPTIMIZATION_THRESHOLD
            )
            
            # Verify database updates
            stored_relationships = await self._db_connection.execute_query(
                "MATCH ()-[r:RELATIONSHIP]->() RETURN count(r) as rel_count"
            )
            assert stored_relationships[0]["rel_count"] == len(optimized_graph.relationships)
            
            self.logger.info(
                "Graph optimization test passed",
                extra={
                    "graph_id": optimized_graph.id,
                    "optimization_improvement": post_metrics["average_clustering"] / pre_metrics["average_clustering"]
                }
            )

        except Exception as e:
            self.logger.error(f"Graph optimization test failed: {str(e)}")
            raise

    async def test_graph_complexity_validation(self):
        """Test graph complexity validation including connection density."""
        try:
            # Generate test graph with specific complexity
            complex_nodes = self._test_graphs["valid_graphs"][1]["nodes"]
            
            graph = await self._graph_builder.build_graph(
                nodes=complex_nodes,
                graph_name=TEST_GRAPH_NAME
            )
            
            # Validate minimum connections
            for node in graph.nodes:
                connections = await graph.traverse_async(
                    start_node_id=node.id,
                    max_depth=1
                )
                assert len(connections["relationships"]) >= MIN_CONNECTIONS_PER_NODE
            
            # Check relationship distribution
            distribution = await graph.analyze_subgraph(
                root_node_id=graph.nodes[0].id,
                metrics=["centrality", "shortest_paths"]
            )
            
            # Verify graph density
            assert distribution["density"] >= 0.3
            
            # Validate node connectivity patterns
            assert all(
                len(paths) > 0 
                for paths in distribution["shortest_paths"].values()
            )
            
            self.logger.info(
                "Graph complexity validation passed",
                extra={
                    "graph_id": graph.id,
                    "density": distribution["density"],
                    "avg_path_length": sum(
                        len(p) for p in distribution["shortest_paths"].values()
                    ) / len(distribution["shortest_paths"])
                }
            )

        except Exception as e:
            self.logger.error(f"Graph complexity validation failed: {str(e)}")
            raise

    async def test_invalid_graph_generation(self):
        """Test error handling for invalid graph generation attempts."""
        try:
            # Load invalid test data
            invalid_nodes = self._test_graphs["invalid_graphs"][0]["nodes"]
            
            # Attempt graph generation
            with pytest.raises(GraphValidationError):
                await self._graph_builder.build_graph(
                    nodes=invalid_nodes,
                    graph_name=TEST_GRAPH_NAME
                )
            
            # Verify no partial graph persistence
            stored_nodes = await self._db_connection.execute_query(
                "MATCH (n:Node) WHERE n.graph_name = $graph_name RETURN count(n) as count",
                {"graph_name": TEST_GRAPH_NAME}
            )
            assert stored_nodes[0]["count"] == 0
            
            self.logger.info("Invalid graph generation test passed")

        except Exception as e:
            self.logger.error(f"Invalid graph generation test failed: {str(e)}")
            raise

    async def teardown_method(self, method):
        """Clean up test environment after each test."""
        try:
            # Clean up test data
            await self._db_connection.execute_query(
                "MATCH (n) DETACH DELETE n"
            )
            
            await super().teardown_method(method)
            
        except Exception as e:
            self.logger.error(f"Test cleanup failed: {str(e)}")
            raise