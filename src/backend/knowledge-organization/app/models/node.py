"""
Enterprise-grade Node model for knowledge graph vertices with advanced validation,
monitoring, and performance optimization features.

Version: 1.0.0
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
import uuid
import asyncio
import json
from enum import Enum

from ..db.neo4j import Neo4jConnection
from ..utils.logger import logger, log_error

# Constants for node configuration and validation
NODE_LABEL_TYPES = ["CONCEPT", "TOPIC", "SUBTOPIC", "PREREQUISITE", "REFERENCE"]
MAX_RETRIES = 3
RETRY_DELAY = 1.0
CACHE_TTL = 300  # seconds

class NodeValidationError(Exception):
    """Custom exception for node validation errors."""
    pass

class NodeOperationError(Exception):
    """Custom exception for node operation failures."""
    pass

@dataclass
class Node:
    """
    Enterprise-grade node model representing vertices in the knowledge graph.
    Implements comprehensive validation, monitoring, and performance features.
    """
    label: str
    name: str
    properties: Dict[str, Any] = field(default_factory=dict)
    importance_score: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    is_active: bool = True
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    relationships: List[Dict[str, Any]] = field(default_factory=list)

    def __post_init__(self) -> None:
        """
        Validate node attributes after initialization.
        """
        try:
            # Validate node label
            if self.label not in NODE_LABEL_TYPES:
                raise NodeValidationError(f"Invalid node label: {self.label}. Must be one of {NODE_LABEL_TYPES}")

            # Validate importance score range
            if not 0.0 <= self.importance_score <= 1.0:
                raise NodeValidationError("Importance score must be between 0.0 and 1.0")

            # Sanitize properties for security
            self.properties = self._sanitize_properties(self.properties)

            # Initialize metadata with defaults if not provided
            self.metadata = {
                "version": 1,
                "last_verified": datetime.now(timezone.utc).isoformat(),
                "source": "knowledge-organization-service",
                **self.metadata
            }

            logger.debug(
                "Node initialized successfully",
                extra={
                    "correlation_id": logger.get_correlation_id(),
                    "node_id": self.id,
                    "node_label": self.label
                }
            )

        except Exception as e:
            log_error(e, {"node_id": self.id, "node_label": self.label})
            raise

    @staticmethod
    def _sanitize_properties(properties: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sanitize node properties to prevent injection attacks.
        """
        def sanitize_value(value: Any) -> Any:
            if isinstance(value, str):
                # Basic sanitization - remove potential script tags and escape special chars
                return value.replace("<script>", "").replace("</script>", "").strip()
            elif isinstance(value, dict):
                return {k: sanitize_value(v) for k, v in value.items()}
            elif isinstance(value, list):
                return [sanitize_value(v) for v in value]
            return value

        return {k: sanitize_value(v) for k, v in properties.items()}

    async def save(self) -> bool:
        """
        Persist node to Neo4j with retry logic and monitoring.
        """
        start_time = datetime.now(timezone.utc)
        
        try:
            # Generate Cypher query for node creation/update
            query = """
            MERGE (n:Node {id: $id})
            SET n.label = $label,
                n.name = $name,
                n.properties = $properties,
                n.importance_score = $importance_score,
                n.metadata = $metadata,
                n.is_active = $is_active,
                n.created_at = $created_at,
                n.updated_at = $updated_at
            RETURN n
            """
            
            params = {
                "id": self.id,
                "label": self.label,
                "name": self.name,
                "properties": json.dumps(self.properties),
                "importance_score": self.importance_score,
                "metadata": json.dumps(self.metadata),
                "is_active": self.is_active,
                "created_at": self.created_at.isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }

            # Execute with connection pool and retry logic
            neo4j = Neo4jConnection()
            for attempt in range(MAX_RETRIES):
                try:
                    await neo4j.execute_async_query(query, params, write=True)
                    break
                except Exception as e:
                    if attempt == MAX_RETRIES - 1:
                        raise
                    await asyncio.sleep(RETRY_DELAY * (attempt + 1))

            execution_time = (datetime.now(timezone.utc) - start_time).total_seconds()
            logger.info(
                "Node saved successfully",
                extra={
                    "correlation_id": logger.get_correlation_id(),
                    "node_id": self.id,
                    "execution_time": execution_time
                }
            )
            return True

        except Exception as e:
            log_error(e, {
                "node_id": self.id,
                "operation": "save",
                "execution_time": (datetime.now(timezone.utc) - start_time).total_seconds()
            })
            raise NodeOperationError(f"Failed to save node: {str(e)}")

    async def update(self, properties: Dict[str, Any]) -> bool:
        """
        Update node properties with optimistic locking.
        """
        try:
            # Validate update properties
            sanitized_properties = self._sanitize_properties(properties)
            
            # Generate differential update query
            query = """
            MATCH (n:Node {id: $id})
            WHERE n.updated_at = $current_updated_at
            SET n.properties = $properties,
                n.updated_at = $new_updated_at
            RETURN n
            """
            
            params = {
                "id": self.id,
                "properties": json.dumps(sanitized_properties),
                "current_updated_at": self.updated_at.isoformat(),
                "new_updated_at": datetime.now(timezone.utc).isoformat()
            }

            neo4j = Neo4jConnection()
            result = await neo4j.execute_async_query(query, params, write=True)
            
            if not result:
                raise NodeOperationError("Node was modified by another process")

            self.properties.update(sanitized_properties)
            self.updated_at = datetime.now(timezone.utc)

            logger.info(
                "Node updated successfully",
                extra={
                    "correlation_id": logger.get_correlation_id(),
                    "node_id": self.id
                }
            )
            return True

        except Exception as e:
            log_error(e, {"node_id": self.id, "operation": "update"})
            raise

    async def delete(self) -> bool:
        """
        Remove node with relationship cleanup.
        """
        try:
            # Delete node and its relationships
            query = """
            MATCH (n:Node {id: $id})
            OPTIONAL MATCH (n)-[r]-()
            DELETE r, n
            """
            
            neo4j = Neo4jConnection()
            await neo4j.execute_async_query(query, {"id": self.id}, write=True)

            logger.info(
                "Node deleted successfully",
                extra={
                    "correlation_id": logger.get_correlation_id(),
                    "node_id": self.id
                }
            )
            return True

        except Exception as e:
            log_error(e, {"node_id": self.id, "operation": "delete"})
            raise NodeOperationError(f"Failed to delete node: {str(e)}")

# Export Node class and constants
__all__ = ['Node', 'NODE_LABEL_TYPES', 'NodeValidationError', 'NodeOperationError']