"""
Enterprise-grade Relationship model for knowledge graph edges with advanced validation,
monitoring, and security features.

Version: 1.0.0
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import uuid
import asyncio
import json
import bleach  # bleach v6.0.0
from enum import Enum

from .node import Node
from ..db.neo4j import Neo4jConnection
from ..utils.logger import logger, log_error

# Constants for relationship configuration and validation
RELATIONSHIP_TYPES = [
    "IS_PREREQUISITE",
    "IS_RELATED", 
    "CONTAINS",
    "REFERENCES",
    "EXTENDS"
]

RETRY_CONFIG = {
    "max_attempts": 3,
    "backoff_factor": 1.5
}

CIRCUIT_BREAKER_CONFIG = {
    "failure_threshold": 5,
    "recovery_timeout": 30
}

class RelationshipValidationError(Exception):
    """Custom exception for relationship validation errors."""
    pass

class RelationshipOperationError(Exception):
    """Custom exception for relationship operation failures."""
    pass

@dataclass
class Relationship:
    """
    Enterprise-grade relationship model representing edges in the knowledge graph.
    Implements comprehensive validation, monitoring, and security features.
    """
    type: str
    source_id: str
    target_id: str
    weight: float = 1.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    correlation_id: str = field(default_factory=lambda: logger.get_correlation_id())
    version: int = 1

    def __post_init__(self) -> None:
        """
        Validate relationship attributes after initialization.
        """
        try:
            # Validate relationship type
            if self.type not in RELATIONSHIP_TYPES:
                raise RelationshipValidationError(
                    f"Invalid relationship type: {self.type}. Must be one of {RELATIONSHIP_TYPES}"
                )

            # Validate weight range
            if not 0.0 <= self.weight <= 1.0:
                raise RelationshipValidationError("Weight must be between 0.0 and 1.0")

            # Sanitize metadata
            self.metadata = self._sanitize_metadata(self.metadata)

            # Initialize metadata with defaults if not provided
            self.metadata = {
                "version": self.version,
                "last_verified": datetime.now(timezone.utc).isoformat(),
                "source": "knowledge-organization-service",
                **self.metadata
            }

            logger.debug(
                "Relationship initialized successfully",
                extra={
                    "correlation_id": self.correlation_id,
                    "relationship_id": self.id,
                    "relationship_type": self.type
                }
            )

        except Exception as e:
            log_error(e, {
                "relationship_id": self.id,
                "relationship_type": self.type
            })
            raise

    @staticmethod
    def _sanitize_metadata(metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sanitize relationship metadata to prevent injection attacks.
        """
        def sanitize_value(value: Any) -> Any:
            if isinstance(value, str):
                return bleach.clean(value, strip=True)
            elif isinstance(value, dict):
                return {k: sanitize_value(v) for k, v in value.items()}
            elif isinstance(value, list):
                return [sanitize_value(v) for v in value]
            return value

        return {k: sanitize_value(v) for k, v in metadata.items()}

    async def async_save(self) -> bool:
        """
        Persist relationship to Neo4j with retry logic and monitoring.
        """
        start_time = datetime.now(timezone.utc)
        
        try:
            # Generate Cypher query for relationship creation
            query = """
            MATCH (source:Node {id: $source_id})
            MATCH (target:Node {id: $target_id})
            MERGE (source)-[r:RELATIONSHIP {id: $id}]->(target)
            SET r.type = $type,
                r.weight = $weight,
                r.metadata = $metadata,
                r.created_at = $created_at,
                r.updated_at = $updated_at,
                r.version = $version
            RETURN r
            """
            
            params = {
                "id": self.id,
                "source_id": self.source_id,
                "target_id": self.target_id,
                "type": self.type,
                "weight": self.weight,
                "metadata": json.dumps(self.metadata),
                "created_at": self.created_at.isoformat(),
                "updated_at": self.updated_at.isoformat(),
                "version": self.version
            }

            # Execute with connection pool and retry logic
            neo4j = Neo4jConnection()
            for attempt in range(RETRY_CONFIG["max_attempts"]):
                try:
                    await neo4j.execute_async_query(query, params, write=True)
                    break
                except Exception as e:
                    if attempt == RETRY_CONFIG["max_attempts"] - 1:
                        raise
                    await asyncio.sleep(RETRY_CONFIG["backoff_factor"] * (attempt + 1))

            execution_time = (datetime.now(timezone.utc) - start_time).total_seconds()
            logger.info(
                "Relationship saved successfully",
                extra={
                    "correlation_id": self.correlation_id,
                    "relationship_id": self.id,
                    "execution_time": execution_time
                }
            )
            return True

        except Exception as e:
            log_error(e, {
                "relationship_id": self.id,
                "operation": "save",
                "execution_time": (datetime.now(timezone.utc) - start_time).total_seconds()
            })
            raise RelationshipOperationError(f"Failed to save relationship: {str(e)}")

    async def async_update(self, properties: Dict[str, Any]) -> bool:
        """
        Update relationship properties with optimistic locking.
        """
        try:
            # Validate update properties
            if not self.validate_properties(properties):
                raise RelationshipValidationError("Invalid update properties")

            sanitized_properties = self._sanitize_metadata(properties)
            
            # Generate differential update query with version check
            query = """
            MATCH ()-[r:RELATIONSHIP {id: $id}]->()
            WHERE r.version = $current_version
            SET r += $properties,
                r.updated_at = $updated_at,
                r.version = $new_version
            RETURN r
            """
            
            params = {
                "id": self.id,
                "properties": sanitized_properties,
                "current_version": self.version,
                "new_version": self.version + 1,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }

            neo4j = Neo4jConnection()
            result = await neo4j.execute_async_query(query, params, write=True)
            
            if not result:
                raise RelationshipOperationError("Relationship was modified by another process")

            self.version += 1
            self.updated_at = datetime.now(timezone.utc)
            self.metadata.update(sanitized_properties)

            logger.info(
                "Relationship updated successfully",
                extra={
                    "correlation_id": self.correlation_id,
                    "relationship_id": self.id
                }
            )
            return True

        except Exception as e:
            log_error(e, {"relationship_id": self.id, "operation": "update"})
            raise

    async def async_delete(self) -> bool:
        """
        Remove relationship with logging.
        """
        try:
            query = """
            MATCH ()-[r:RELATIONSHIP {id: $id}]->()
            DELETE r
            """
            
            neo4j = Neo4jConnection()
            await neo4j.execute_async_query(query, {"id": self.id}, write=True)

            logger.info(
                "Relationship deleted successfully",
                extra={
                    "correlation_id": self.correlation_id,
                    "relationship_id": self.id
                }
            )
            return True

        except Exception as e:
            log_error(e, {"relationship_id": self.id, "operation": "delete"})
            raise RelationshipOperationError(f"Failed to delete relationship: {str(e)}")

    def validate_properties(self, properties: Dict[str, Any]) -> bool:
        """
        Validate relationship properties against schema.
        """
        try:
            # Check required fields
            required_fields = {"type", "weight"}
            if not all(field in properties for field in required_fields & properties.keys()):
                return False

            # Validate property types and values
            if "type" in properties and properties["type"] not in RELATIONSHIP_TYPES:
                return False

            if "weight" in properties and not 0.0 <= float(properties["weight"]) <= 1.0:
                return False

            return True

        except Exception as e:
            logger.error(
                f"Property validation failed: {str(e)}",
                extra={
                    "correlation_id": self.correlation_id,
                    "relationship_id": self.id
                }
            )
            return False

# Export Relationship class and constants
__all__ = [
    'Relationship',
    'RELATIONSHIP_TYPES',
    'RelationshipValidationError',
    'RelationshipOperationError'
]