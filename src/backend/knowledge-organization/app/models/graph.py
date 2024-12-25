"""
Enterprise-grade Graph model for managing complete knowledge graph structures.
Implements comprehensive graph operations, traversal algorithms, and optimization
using Neo4j database with support for large-scale enterprise deployments.

Version: 1.0.0
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Set, Tuple
import uuid
import asyncio
import networkx as nx  # networkx v3.1
import redis  # redis v4.5.0
from prometheus_client import Counter, Histogram  # prometheus_client v0.17.0

from .node import Node, NodeValidationError
from .relationship import Relationship, RelationshipValidationError
from ..db.neo4j import Neo4jConnection
from ..utils.logger import logger, log_error

# Constants for graph configuration and validation
GRAPH_TYPES = ["KNOWLEDGE_GRAPH", "TOPIC_GRAPH", "PREREQUISITE_GRAPH", "SEMANTIC_GRAPH"]
CACHE_TTL = 3600  # seconds
MAX_BATCH_SIZE = 1000
DEFAULT_RETRY_COUNT = 3

# Monitoring metrics
GRAPH_OPERATIONS = Counter(
    'knowledge_graph_operations_total',
    'Total number of graph operations',
    ['operation_type']
)

OPERATION_DURATION = Histogram(
    'knowledge_graph_operation_duration_seconds',
    'Duration of graph operations',
    ['operation_type']
)

class GraphValidationError(Exception):
    """Custom exception for graph validation errors."""
    pass

class GraphOperationError(Exception):
    """Custom exception for graph operation failures."""
    pass

@dataclass
class Graph:
    """
    Enterprise-grade knowledge graph structure with comprehensive management capabilities.
    Implements advanced graph operations, caching, and monitoring features.
    """
    name: str
    type: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    nodes: List[Node] = field(default_factory=list)
    relationships: List[Relationship] = field(default_factory=list)
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    version: int = 1
    cache_config: Dict[str, Any] = field(default_factory=dict)
    monitoring_config: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        """
        Initialize graph with validation and setup monitoring.
        """
        try:
            # Validate graph type
            if self.type not in GRAPH_TYPES:
                raise GraphValidationError(f"Invalid graph type: {self.type}")

            # Initialize Neo4j connection
            self._db = Neo4jConnection()

            # Initialize Redis cache if configured
            self._cache = None
            if self.cache_config.get('enabled', False):
                self._cache = redis.Redis(
                    host=self.cache_config.get('host', 'localhost'),
                    port=self.cache_config.get('port', 6379),
                    db=self.cache_config.get('db', 0)
                )

            # Initialize metadata
            self.metadata = {
                "version": self.version,
                "node_count": len(self.nodes),
                "relationship_count": len(self.relationships),
                "last_modified": datetime.now(timezone.utc).isoformat(),
                **self.metadata
            }

            logger.info(
                "Graph initialized successfully",
                extra={
                    "correlation_id": logger.get_correlation_id(),
                    "graph_id": self.id,
                    "graph_type": self.type
                }
            )

        except Exception as e:
            log_error(e, {"graph_id": self.id, "graph_type": self.type})
            raise

    async def add_node(self, node: Node, skip_validation: bool = False, use_cache: bool = True) -> bool:
        """
        Add a new node to the graph with validation and caching.
        """
        with OPERATION_DURATION.labels(operation_type='add_node').time():
            try:
                if not skip_validation:
                    node.validate()

                # Check cache first if enabled
                if use_cache and self._cache:
                    cache_key = f"node:{node.id}"
                    if await self._cache.exists(cache_key):
                        return True

                # Begin transaction
                async with self._db.begin_transaction() as tx:
                    await node.save()
                    self.nodes.append(node)
                    
                    # Update metadata
                    self.metadata["node_count"] = len(self.nodes)
                    self.metadata["last_modified"] = datetime.now(timezone.utc).isoformat()
                    self.version += 1

                    # Update cache if enabled
                    if use_cache and self._cache:
                        await self._cache.set(
                            f"node:{node.id}",
                            node.to_dict(),
                            ex=CACHE_TTL
                        )

                GRAPH_OPERATIONS.labels(operation_type='add_node').inc()
                return True

            except Exception as e:
                log_error(e, {
                    "graph_id": self.id,
                    "node_id": node.id,
                    "operation": "add_node"
                })
                raise GraphOperationError(f"Failed to add node: {str(e)}")

    async def add_relationships_batch(
        self,
        relationships: List[Relationship],
        skip_validation: bool = False
    ) -> Dict[str, Any]:
        """
        Add multiple relationships in an optimized batch operation.
        """
        with OPERATION_DURATION.labels(operation_type='add_relationships_batch').time():
            try:
                if len(relationships) > MAX_BATCH_SIZE:
                    raise GraphValidationError(f"Batch size exceeds maximum of {MAX_BATCH_SIZE}")

                valid_relationships = []
                for rel in relationships:
                    if not skip_validation:
                        if not rel.validate_properties(rel.__dict__):
                            logger.warning(
                                f"Skipping invalid relationship: {rel.id}",
                                extra={"correlation_id": logger.get_correlation_id()}
                            )
                            continue
                    valid_relationships.append(rel)

                # Group relationships by type for optimized batch processing
                grouped_relationships = {}
                for rel in valid_relationships:
                    grouped_relationships.setdefault(rel.type, []).append(rel)

                # Execute batch save operation
                async with self._db.begin_transaction() as tx:
                    for rel_type, rel_group in grouped_relationships.items():
                        await Relationship.batch_save(rel_group)
                        self.relationships.extend(rel_group)

                    # Update metadata
                    self.metadata["relationship_count"] = len(self.relationships)
                    self.metadata["last_modified"] = datetime.now(timezone.utc).isoformat()
                    self.version += 1

                GRAPH_OPERATIONS.labels(operation_type='add_relationships_batch').inc()
                
                return {
                    "success": True,
                    "added_count": len(valid_relationships),
                    "skipped_count": len(relationships) - len(valid_relationships)
                }

            except Exception as e:
                log_error(e, {
                    "graph_id": self.id,
                    "operation": "add_relationships_batch"
                })
                raise GraphOperationError(f"Failed to add relationships batch: {str(e)}")

    async def traverse_async(
        self,
        start_node_id: str,
        max_depth: int = 3,
        relationship_types: Optional[List[str]] = None,
        filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Asynchronously traverse the graph with advanced filtering.
        """
        with OPERATION_DURATION.labels(operation_type='traverse').time():
            try:
                # Validate start node exists
                if not any(node.id == start_node_id for node in self.nodes):
                    raise GraphValidationError(f"Start node {start_node_id} not found")

                # Build traversal query with filters
                query = """
                MATCH path = (start:Node {id: $start_id})
                -[r:RELATIONSHIP*1..{max_depth}]->
                (end:Node)
                WHERE ALL(rel IN r WHERE rel.type IN $rel_types)
                """

                if filters:
                    for key, value in filters.items():
                        query += f" AND end.{key} = ${key}"

                query += " RETURN path"

                params = {
                    "start_id": start_node_id,
                    "max_depth": max_depth,
                    "rel_types": relationship_types or list(GRAPH_TYPES),
                    **filters or {}
                }

                # Execute traversal
                paths = await self._db.execute_async_query(query, params)

                # Process and cache results
                processed_paths = self._process_traversal_results(paths)
                
                if self._cache:
                    cache_key = f"traverse:{start_node_id}:{max_depth}"
                    await self._cache.set(
                        cache_key,
                        processed_paths,
                        ex=CACHE_TTL
                    )

                GRAPH_OPERATIONS.labels(operation_type='traverse').inc()
                
                return processed_paths

            except Exception as e:
                log_error(e, {
                    "graph_id": self.id,
                    "start_node": start_node_id,
                    "operation": "traverse"
                })
                raise GraphOperationError(f"Failed to traverse graph: {str(e)}")

    async def analyze_subgraph(
        self,
        root_node_id: str,
        metrics: List[str] = None,
        analysis_config: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Perform detailed analysis on a subgraph.
        """
        with OPERATION_DURATION.labels(operation_type='analyze').time():
            try:
                # Extract subgraph
                subgraph_data = await self.traverse_async(
                    root_node_id,
                    max_depth=analysis_config.get('max_depth', 3)
                )

                # Convert to NetworkX for analysis
                G = nx.DiGraph()
                for node in subgraph_data['nodes']:
                    G.add_node(node['id'], **node)
                for edge in subgraph_data['relationships']:
                    G.add_edge(
                        edge['source_id'],
                        edge['target_id'],
                        **edge
                    )

                results = {
                    "node_count": G.number_of_nodes(),
                    "edge_count": G.number_of_edges(),
                    "density": nx.density(G),
                    "is_dag": nx.is_directed_acyclic_graph(G)
                }

                # Calculate requested metrics
                if metrics:
                    if "centrality" in metrics:
                        results["centrality"] = nx.degree_centrality(G)
                    if "communities" in metrics:
                        results["communities"] = list(nx.community.greedy_modularity_communities(G.to_undirected()))
                    if "shortest_paths" in metrics:
                        results["shortest_paths"] = dict(nx.all_pairs_shortest_path_length(G))

                GRAPH_OPERATIONS.labels(operation_type='analyze').inc()

                return results

            except Exception as e:
                log_error(e, {
                    "graph_id": self.id,
                    "root_node": root_node_id,
                    "operation": "analyze"
                })
                raise GraphOperationError(f"Failed to analyze subgraph: {str(e)}")

    def _process_traversal_results(self, paths: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Process and format traversal results.
        """
        nodes_seen = set()
        relationships_seen = set()
        processed_paths = []

        for path in paths:
            current_path = []
            for node in path['nodes']:
                if node['id'] not in nodes_seen:
                    nodes_seen.add(node['id'])
                current_path.append(node['id'])

            for rel in path['relationships']:
                rel_key = f"{rel['source_id']}-{rel['target_id']}"
                if rel_key not in relationships_seen:
                    relationships_seen.add(rel_key)
            
            processed_paths.append(current_path)

        return {
            "paths": processed_paths,
            "nodes": list(nodes_seen),
            "relationships": list(relationships_seen),
            "metadata": {
                "path_count": len(processed_paths),
                "node_count": len(nodes_seen),
                "relationship_count": len(relationships_seen)
            }
        }

# Export Graph class and constants
__all__ = [
    'Graph',
    'GRAPH_TYPES',
    'GraphValidationError',
    'GraphOperationError'
]