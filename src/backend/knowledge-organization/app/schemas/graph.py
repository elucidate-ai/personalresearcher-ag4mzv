"""
Enterprise-grade Pydantic schemas for validating knowledge graph data structures.
Provides comprehensive validation for nodes, relationships, and complete graphs.

Version: 1.0.0
"""

from datetime import datetime
from typing import Dict, List, Any, Optional
from uuid import UUID
from pydantic import BaseModel, Field, validator, root_validator

# Import constants from models
from ..models.graph import GRAPH_TYPES
from ..models.node import NODE_LABEL_TYPES
from ..models.relationship import RELATIONSHIP_TYPES

class NodeSchema(BaseModel):
    """
    Comprehensive schema for validating node data with enhanced validation rules.
    """
    id: UUID = Field(description="Unique identifier for the node")
    label: str = Field(description="Node type label")
    name: str = Field(description="Human-readable node name")
    properties: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional node properties"
    )
    importance_score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Node importance score between 0 and 1"
    )
    created_at: datetime = Field(description="Node creation timestamp")
    updated_at: datetime = Field(description="Last update timestamp")

    @validator('label')
    def validate_label(cls, value: str) -> str:
        """
        Validate node label against allowed types with enhanced error handling.
        """
        if value not in NODE_LABEL_TYPES:
            raise ValueError(
                f"Invalid node label: {value}. Must be one of: {', '.join(NODE_LABEL_TYPES)}"
            )
        return value

    @validator('importance_score')
    def validate_importance_score(cls, value: float) -> float:
        """
        Validate and normalize node importance score.
        """
        if not 0.0 <= value <= 1.0:
            raise ValueError("Importance score must be between 0.0 and 1.0")
        return round(value, 4)  # Normalize to 4 decimal places

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }

class RelationshipSchema(BaseModel):
    """
    Comprehensive schema for validating relationship data with enhanced validation rules.
    """
    id: UUID = Field(description="Unique identifier for the relationship")
    type: str = Field(description="Relationship type")
    source_id: UUID = Field(description="Source node ID")
    target_id: UUID = Field(description="Target node ID")
    weight: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Relationship weight between 0 and 1"
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional relationship metadata"
    )
    created_at: datetime = Field(description="Relationship creation timestamp")
    updated_at: datetime = Field(description="Last update timestamp")

    @validator('type')
    def validate_type(cls, value: str) -> str:
        """
        Validate relationship type with enhanced error handling.
        """
        if value not in RELATIONSHIP_TYPES:
            raise ValueError(
                f"Invalid relationship type: {value}. Must be one of: {', '.join(RELATIONSHIP_TYPES)}"
            )
        return value

    @validator('weight')
    def validate_weight(cls, value: float) -> float:
        """
        Validate and normalize relationship weight.
        """
        if not 0.0 <= value <= 1.0:
            raise ValueError("Weight must be between 0.0 and 1.0")
        return round(value, 4)  # Normalize to 4 decimal places

    @root_validator
    def validate_source_target(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate source and target nodes are different.
        """
        source_id = values.get('source_id')
        target_id = values.get('target_id')
        if source_id and target_id and source_id == target_id:
            raise ValueError("Source and target nodes must be different")
        return values

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }

class GraphSchema(BaseModel):
    """
    Comprehensive schema for validating complete graph data with cross-validation support.
    """
    id: UUID = Field(description="Unique identifier for the graph")
    name: str = Field(description="Human-readable graph name")
    type: str = Field(description="Graph type")
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional graph metadata"
    )
    nodes: List[NodeSchema] = Field(
        default_factory=list,
        description="List of graph nodes"
    )
    relationships: List[RelationshipSchema] = Field(
        default_factory=list,
        description="List of graph relationships"
    )
    created_at: datetime = Field(description="Graph creation timestamp")
    updated_at: datetime = Field(description="Last update timestamp")

    @validator('type')
    def validate_type(cls, value: str) -> str:
        """
        Validate graph type with enhanced error handling.
        """
        if value not in GRAPH_TYPES:
            raise ValueError(
                f"Invalid graph type: {value}. Must be one of: {', '.join(GRAPH_TYPES)}"
            )
        return value

    @validator('relationships')
    def validate_relationships(cls, relationships: List[RelationshipSchema], values: Dict[str, Any]) -> List[RelationshipSchema]:
        """
        Validate relationship nodes exist and graph consistency.
        """
        if not values.get('nodes'):
            return relationships

        # Create set of node IDs for efficient lookup
        node_ids = {str(node.id) for node in values['nodes']}

        # Validate all relationship nodes exist
        for rel in relationships:
            source_id = str(rel.source_id)
            target_id = str(rel.target_id)
            
            if source_id not in node_ids:
                raise ValueError(f"Source node {source_id} not found in graph nodes")
            if target_id not in node_ids:
                raise ValueError(f"Target node {target_id} not found in graph nodes")

        # Check for cycles in certain graph types
        if values.get('type') == "PREREQUISITE_GRAPH":
            edges = [(str(rel.source_id), str(rel.target_id)) for rel in relationships]
            if _has_cycle(edges):
                raise ValueError("Prerequisite graph cannot contain cycles")

        return relationships

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }

def _has_cycle(edges: List[tuple]) -> bool:
    """
    Helper function to detect cycles in a directed graph.
    """
    graph = {}
    for source, target in edges:
        graph.setdefault(source, []).append(target)

    visited = set()
    path = set()

    def dfs(vertex: str) -> bool:
        visited.add(vertex)
        path.add(vertex)
        
        for neighbor in graph.get(vertex, []):
            if neighbor not in visited:
                if dfs(neighbor):
                    return True
            elif neighbor in path:
                return True
                
        path.remove(vertex)
        return False

    for vertex in graph:
        if vertex not in visited:
            if dfs(vertex):
                return True
    return False

# Export schemas
__all__ = [
    'NodeSchema',
    'RelationshipSchema',
    'GraphSchema'
]