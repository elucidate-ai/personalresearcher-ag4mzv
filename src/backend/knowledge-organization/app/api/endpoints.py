"""
FastAPI endpoints for Knowledge Organization service with comprehensive graph operations,
relationship management, and monitoring capabilities.

Version: 1.0.0
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Query, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import asyncio
from datetime import datetime, timezone
from prometheus_client import Counter, Histogram

from ..config import settings
from ..core.graph_builder import GraphBuilder
from ..db.neo4j import Neo4jConnection
from ..utils.logger import logger, log_error

# Initialize router with prefix and tags
router = APIRouter(
    prefix="/api/v1/knowledge",
    tags=["knowledge"]
)

# Initialize database connection
db = Neo4jConnection()

# Prometheus metrics
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

# Request/Response Models
class Node(BaseModel):
    """Node data model for graph construction."""
    id: str = Field(..., description="Unique node identifier")
    content: Dict[str, Any] = Field(..., description="Node content data")
    vector: List[float] = Field(..., description="Vector embedding")
    metadata: Optional[Dict[str, Any]] = Field(default={}, description="Additional metadata")

class GraphRequest(BaseModel):
    """Request model for graph creation."""
    name: str = Field(..., description="Name of the knowledge graph")
    nodes: List[Node] = Field(..., description="List of nodes to include in graph")
    metadata: Dict[str, Any] = Field(default={}, description="Graph metadata")
    optimization_settings: Optional[Dict[str, Any]] = Field(
        default={},
        description="Graph optimization parameters"
    )

class GraphResponse(BaseModel):
    """Response model for graph operations."""
    graph_id: str = Field(..., description="Unique graph identifier")
    status: str = Field(..., description="Operation status")
    node_count: int = Field(..., description="Number of nodes in graph")
    relationship_count: int = Field(..., description="Number of relationships")
    metrics: Dict[str, Any] = Field(..., description="Graph metrics and statistics")
    created_at: str = Field(..., description="Graph creation timestamp")

@router.post("/graphs", response_model=GraphResponse)
async def create_graph(
    request: GraphRequest,
    background_tasks: BackgroundTasks
) -> GraphResponse:
    """
    Create a new knowledge graph with comprehensive validation and optimization.

    Args:
        request: Graph creation request with nodes and settings
        background_tasks: FastAPI background tasks handler

    Returns:
        GraphResponse: Created graph details with validation status

    Raises:
        HTTPException: If graph creation fails or validation errors occur
    """
    operation_start = datetime.now(timezone.utc)
    
    try:
        logger.info(
            "Starting graph creation",
            extra={
                "correlation_id": logger.get_correlation_id(),
                "graph_name": request.name,
                "node_count": len(request.nodes)
            }
        )

        # Initialize graph builder with optimization settings
        graph_builder = GraphBuilder(
            relationship_extractor=None,  # Will be injected by DI
            graph_optimizer=None,  # Will be injected by DI
            build_config=request.optimization_settings
        )

        # Build graph with validation
        graph = await graph_builder.build_graph(
            nodes=[node.dict() for node in request.nodes],
            graph_name=request.name,
            metadata=request.metadata
        )

        # Validate graph complexity
        if not graph_builder.validate_graph_complexity(graph):
            raise HTTPException(
                status_code=400,
                detail="Graph does not meet complexity requirements"
            )

        # Schedule optimization in background
        background_tasks.add_task(
            graph_builder.optimize_relationships,
            graph
        )

        # Calculate response metrics
        metrics = {
            "average_connections": sum(dict(graph.degree()).values()) / len(request.nodes),
            "density": graph.density(),
            "clustering_coefficient": graph.average_clustering(),
            "build_duration": (datetime.now(timezone.utc) - operation_start).total_seconds()
        }

        # Record operation metrics
        GRAPH_OPERATIONS.labels(operation_type="create_graph").inc()
        OPERATION_DURATION.labels(operation_type="create_graph").observe(
            metrics["build_duration"]
        )

        response = GraphResponse(
            graph_id=graph.id,
            status="created",
            node_count=len(request.nodes),
            relationship_count=len(graph.relationships),
            metrics=metrics,
            created_at=operation_start.isoformat()
        )

        logger.info(
            "Graph created successfully",
            extra={
                "correlation_id": logger.get_correlation_id(),
                "graph_id": graph.id,
                "duration": metrics["build_duration"]
            }
        )

        return response

    except Exception as e:
        log_error(e, {
            "operation": "create_graph",
            "graph_name": request.name,
            "node_count": len(request.nodes)
        })
        raise HTTPException(
            status_code=500,
            detail=f"Graph creation failed: {str(e)}"
        )

@router.get("/graphs/{graph_id}")
async def get_graph(graph_id: str) -> Dict[str, Any]:
    """
    Retrieve graph details with comprehensive metrics.

    Args:
        graph_id: Unique graph identifier

    Returns:
        Dict[str, Any]: Graph details and metrics

    Raises:
        HTTPException: If graph not found or retrieval fails
    """
    try:
        # Query graph from database
        query = """
        MATCH (g:Graph {id: $graph_id})
        OPTIONAL MATCH (g)-[:CONTAINS]->(n:Node)
        OPTIONAL MATCH (n)-[r:RELATIONSHIP]->(m:Node)
        RETURN g, collect(distinct n) as nodes, collect(distinct r) as relationships
        """
        
        result = await db.execute_async_query(
            query,
            {"graph_id": graph_id}
        )

        if not result:
            raise HTTPException(
                status_code=404,
                detail=f"Graph {graph_id} not found"
            )

        # Extract graph data
        graph_data = result[0]
        
        # Calculate current metrics
        metrics = {
            "node_count": len(graph_data["nodes"]),
            "relationship_count": len(graph_data["relationships"]),
            "last_accessed": datetime.now(timezone.utc).isoformat()
        }

        GRAPH_OPERATIONS.labels(operation_type="get_graph").inc()

        return {
            "id": graph_id,
            "name": graph_data["g"]["name"],
            "metadata": graph_data["g"]["metadata"],
            "metrics": metrics,
            "created_at": graph_data["g"]["created_at"]
        }

    except HTTPException:
        raise
    except Exception as e:
        log_error(e, {
            "operation": "get_graph",
            "graph_id": graph_id
        })
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve graph: {str(e)}"
        )

@router.delete("/graphs/{graph_id}")
async def delete_graph(graph_id: str) -> Dict[str, str]:
    """
    Delete graph and all associated nodes and relationships.

    Args:
        graph_id: Unique graph identifier

    Returns:
        Dict[str, str]: Deletion confirmation

    Raises:
        HTTPException: If deletion fails
    """
    try:
        # Begin transaction for atomic deletion
        async with db.begin_transaction() as tx:
            # Delete all relationships first
            await tx.run("""
                MATCH (g:Graph {id: $graph_id})-[:CONTAINS]->(n:Node)
                MATCH (n)-[r:RELATIONSHIP]-()
                DELETE r
            """, {"graph_id": graph_id})

            # Delete nodes
            await tx.run("""
                MATCH (g:Graph {id: $graph_id})-[:CONTAINS]->(n:Node)
                DELETE n
            """, {"graph_id": graph_id})

            # Delete graph
            result = await tx.run("""
                MATCH (g:Graph {id: $graph_id})
                DELETE g
                RETURN count(g) as deleted
            """, {"graph_id": graph_id})

            if result[0]["deleted"] == 0:
                raise HTTPException(
                    status_code=404,
                    detail=f"Graph {graph_id} not found"
                )

        GRAPH_OPERATIONS.labels(operation_type="delete_graph").inc()

        return {"status": "deleted", "graph_id": graph_id}

    except HTTPException:
        raise
    except Exception as e:
        log_error(e, {
            "operation": "delete_graph",
            "graph_id": graph_id
        })
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete graph: {str(e)}"
        )

@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """
    Comprehensive health check of the Knowledge Organization service.

    Returns:
        Dict[str, Any]: Health status and metrics

    Raises:
        HTTPException: If health check fails
    """
    try:
        # Check database connectivity
        await db.execute_async_query("MATCH (n) RETURN count(n) LIMIT 1")

        # Get service metrics
        metrics = {
            "uptime": "healthy",
            "database": "connected",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        if settings.METRICS_ENABLED:
            metrics.update({
                "total_operations": GRAPH_OPERATIONS._value.sum(),
                "average_duration": OPERATION_DURATION._sum.sum() / OPERATION_DURATION._count.sum()
            })

        return {
            "status": "healthy",
            "metrics": metrics
        }

    except Exception as e:
        log_error(e, {"operation": "health_check"})
        raise HTTPException(
            status_code=500,
            detail=f"Health check failed: {str(e)}"
        )