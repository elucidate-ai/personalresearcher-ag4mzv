"""
Enterprise-grade knowledge graph builder with comprehensive construction, validation,
and optimization capabilities. Implements parallel processing, async operations,
and advanced monitoring features.

Version: 1.0.0
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional
import networkx as nx  # networkx v3.1
from datetime import datetime, timezone
from prometheus_client import Counter, Histogram  # prometheus_client v0.17.0

from ...models.graph import Graph, GraphValidationError
from .relationship_extractor import RelationshipExtractor
from .graph_optimizer import GraphOptimizer
from ..utils.logger import logger, log_error

# Constants for graph building configuration
DEFAULT_GRAPH_TYPE = "KNOWLEDGE_GRAPH"
MIN_NODES_REQUIRED = 2
MAX_GRAPH_SIZE = 10000
MIN_CONNECTIONS_PER_NODE = 10
MAX_PARALLEL_TASKS = 5

# Prometheus metrics
GRAPH_BUILD_COUNTER = Counter(
    'knowledge_graph_builds_total',
    'Total number of graph build operations'
)

BUILD_DURATION = Histogram(
    'knowledge_graph_build_duration_seconds',
    'Duration of graph build operations',
    ['operation_type']
)

class GraphBuilder:
    """
    Enterprise-grade graph builder implementing comprehensive graph construction
    with parallel processing, validation, and optimization capabilities.
    """

    def __init__(
        self,
        relationship_extractor: RelationshipExtractor,
        graph_optimizer: GraphOptimizer,
        build_config: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Initialize graph builder with required components and configuration.

        Args:
            relationship_extractor: Component for extracting relationships
            graph_optimizer: Component for graph optimization
            build_config: Optional build configuration parameters
        """
        self._relationship_extractor = relationship_extractor
        self._graph_optimizer = graph_optimizer
        self._build_config = build_config or {}
        self._performance_metrics = {}

        logger.info(
            "Initialized GraphBuilder",
            extra={
                "correlation_id": logger.get_correlation_id(),
                "config": self._build_config
            }
        )

    async def build_graph(
        self,
        nodes: List[Dict[str, Any]],
        graph_name: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Graph:
        """
        Build complete knowledge graph from content nodes with parallel processing.

        Args:
            nodes: List of content nodes
            graph_name: Name for the new graph
            metadata: Optional graph metadata

        Returns:
            Constructed and optimized Graph instance

        Raises:
            GraphValidationError: If input validation fails
            RuntimeError: If graph construction fails
        """
        start_time = datetime.now(timezone.utc)
        
        try:
            # Validate input nodes
            if not self.validate_nodes(nodes):
                raise GraphValidationError("Node validation failed")

            # Initialize graph with metadata
            graph = Graph(
                name=graph_name,
                type=DEFAULT_GRAPH_TYPE,
                metadata={
                    "created_at": start_time.isoformat(),
                    "node_count": len(nodes),
                    "source": "graph-builder",
                    **(metadata or {})
                }
            )

            # Process nodes in parallel batches
            batch_size = min(len(nodes), MAX_PARALLEL_TASKS)
            node_batches = [nodes[i:i + batch_size] for i in range(0, len(nodes), batch_size)]

            for batch in node_batches:
                # Add nodes to graph
                node_tasks = [
                    graph.add_node(node, skip_validation=False)
                    for node in batch
                ]
                await asyncio.gather(*node_tasks)

            # Extract relationships
            relationships = await self._relationship_extractor.extract_relationships(nodes)
            
            # Add relationships in batches
            relationship_batches = [
                relationships[i:i + batch_size]
                for i in range(0, len(relationships), batch_size)
            ]
            
            for batch in relationship_batches:
                await graph.add_relationships_batch(batch)

            # Optimize graph structure
            optimized_graph = await self._graph_optimizer.optimize(graph)

            # Validate graph complexity
            if not self.validate_graph_complexity(optimized_graph):
                raise GraphValidationError("Graph complexity validation failed")

            # Update graph metadata with build metrics
            build_duration = (datetime.now(timezone.utc) - start_time).total_seconds()
            await self.update_graph_metadata(
                optimized_graph,
                {
                    "build_duration": build_duration,
                    "relationships_count": len(relationships),
                    "optimization_metrics": optimized_graph.metadata.get("optimization_metrics", {})
                }
            )

            # Record metrics
            GRAPH_BUILD_COUNTER.inc()
            BUILD_DURATION.labels(
                operation_type="complete_build"
            ).observe(build_duration)

            logger.info(
                "Graph build completed successfully",
                extra={
                    "correlation_id": logger.get_correlation_id(),
                    "graph_id": optimized_graph.id,
                    "duration": build_duration,
                    "nodes": len(nodes),
                    "relationships": len(relationships)
                }
            )

            return optimized_graph

        except Exception as e:
            log_error(e, {
                "operation": "build_graph",
                "graph_name": graph_name,
                "nodes_count": len(nodes)
            })
            raise

    def validate_nodes(self, nodes: List[Dict[str, Any]]) -> bool:
        """
        Validate input nodes for graph construction.

        Args:
            nodes: List of nodes to validate

        Returns:
            bool: Validation result
        """
        try:
            # Check minimum node requirement
            if len(nodes) < MIN_NODES_REQUIRED:
                logger.error(
                    f"Insufficient nodes for graph construction. Minimum required: {MIN_NODES_REQUIRED}",
                    extra={"nodes_provided": len(nodes)}
                )
                return False

            # Check maximum size limit
            if len(nodes) > MAX_GRAPH_SIZE:
                logger.error(
                    f"Node count exceeds maximum limit of {MAX_GRAPH_SIZE}",
                    extra={"nodes_provided": len(nodes)}
                )
                return False

            # Validate node structure
            node_ids = set()
            for node in nodes:
                # Check required fields
                required_fields = {"id", "content", "vector"}
                if not all(field in node for field in required_fields):
                    logger.error(
                        "Missing required fields in node",
                        extra={"node_id": node.get("id"), "missing_fields": required_fields - set(node.keys())}
                    )
                    return False

                # Check for duplicate IDs
                if node["id"] in node_ids:
                    logger.error(
                        "Duplicate node ID detected",
                        extra={"node_id": node["id"]}
                    )
                    return False
                node_ids.add(node["id"])

                # Validate vector dimension
                if "vector" in node and not isinstance(node["vector"], (list, tuple)):
                    logger.error(
                        "Invalid vector format",
                        extra={"node_id": node["id"]}
                    )
                    return False

            return True

        except Exception as e:
            log_error(e, {"operation": "validate_nodes"})
            return False

    def validate_graph_complexity(self, graph: Graph) -> bool:
        """
        Validate graph meets complexity and quality requirements.

        Args:
            graph: Graph to validate

        Returns:
            bool: Validation result
        """
        try:
            # Convert to NetworkX for analysis
            G = nx.DiGraph()
            for rel in graph.relationships:
                G.add_edge(rel.source_id, rel.target_id, weight=rel.weight)

            # Check minimum connections per node
            for node in G.nodes():
                total_connections = G.degree(node)
                if total_connections < MIN_CONNECTIONS_PER_NODE:
                    logger.error(
                        f"Node has insufficient connections. Minimum required: {MIN_CONNECTIONS_PER_NODE}",
                        extra={"node_id": node, "connections": total_connections}
                    )
                    return False

            # Validate graph connectivity
            if not nx.is_strongly_connected(G):
                logger.error("Graph is not strongly connected")
                return False

            # Check relationship distribution
            relationship_distribution = [G.degree(node) for node in G.nodes()]
            avg_connections = sum(relationship_distribution) / len(relationship_distribution)
            if avg_connections < MIN_CONNECTIONS_PER_NODE:
                logger.error(
                    "Average connections per node below threshold",
                    extra={"average_connections": avg_connections}
                )
                return False

            return True

        except Exception as e:
            log_error(e, {"operation": "validate_graph_complexity"})
            return False

    async def update_graph_metadata(self, graph: Graph, build_info: Dict[str, Any]) -> bool:
        """
        Update graph metadata with build information and metrics.

        Args:
            graph: Graph to update
            build_info: Build information to add

        Returns:
            bool: Update success status
        """
        try:
            graph.metadata.update({
                "last_updated": datetime.now(timezone.utc).isoformat(),
                "build_info": build_info,
                "complexity_metrics": {
                    "average_degree": sum(dict(graph.degree()).values()) / graph.number_of_nodes(),
                    "density": nx.density(graph),
                    "diameter": nx.diameter(graph),
                    "clustering_coefficient": nx.average_clustering(graph)
                }
            })
            return True

        except Exception as e:
            log_error(e, {
                "operation": "update_graph_metadata",
                "graph_id": graph.id
            })
            return False