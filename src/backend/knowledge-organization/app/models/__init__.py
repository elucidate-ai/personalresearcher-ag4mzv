"""
Knowledge Organization Models Package
Provides centralized access to enterprise-grade graph data models with type safety and validation.

Version: 1.0.0
"""

# Import core model classes and types
from .node import Node, NODE_LABEL_TYPES, NodeValidationError, NodeOperationError
from .relationship import (
    Relationship,
    RELATIONSHIP_TYPES,
    RelationshipValidationError,
    RelationshipOperationError
)
from .graph import Graph, GRAPH_TYPES, GraphValidationError, GraphOperationError

# Version information
__version__ = "1.0.0"

# Package metadata
__package_name__ = "knowledge-organization-models"
__author__ = "Knowledge Organization Team"
__description__ = "Enterprise-grade graph data models for knowledge organization"

# Export all public models and types
__all__ = [
    # Node exports
    "Node",
    "NODE_LABEL_TYPES",
    "NodeValidationError",
    "NodeOperationError",
    
    # Relationship exports
    "Relationship",
    "RELATIONSHIP_TYPES",
    "RelationshipValidationError",
    "RelationshipOperationError",
    
    # Graph exports
    "Graph",
    "GRAPH_TYPES",
    "GraphValidationError",
    "GraphOperationError",
    
    # Package metadata
    "__version__",
    "__package_name__",
    "__author__",
    "__description__"
]

# Type definitions for better IDE support and type checking
NodeType = Node
RelationshipType = Relationship
GraphType = Graph

# Validate imported types match expected schema
def validate_imported_types() -> bool:
    """
    Validate that imported types match expected schema.
    Raises TypeError if validation fails.
    """
    try:
        # Validate Node type constants
        if not isinstance(NODE_LABEL_TYPES, list):
            raise TypeError("NODE_LABEL_TYPES must be a list")
        if not all(isinstance(label, str) for label in NODE_LABEL_TYPES):
            raise TypeError("All NODE_LABEL_TYPES must be strings")

        # Validate Relationship type constants
        if not isinstance(RELATIONSHIP_TYPES, list):
            raise TypeError("RELATIONSHIP_TYPES must be a list")
        if not all(isinstance(rel_type, str) for rel_type in RELATIONSHIP_TYPES):
            raise TypeError("All RELATIONSHIP_TYPES must be strings")

        # Validate Graph type constants
        if not isinstance(GRAPH_TYPES, list):
            raise TypeError("GRAPH_TYPES must be a list")
        if not all(isinstance(graph_type, str) for graph_type in GRAPH_TYPES):
            raise TypeError("All GRAPH_TYPES must be strings")

        return True

    except Exception as e:
        raise TypeError(f"Type validation failed: {str(e)}")

# Perform type validation on module import
validate_imported_types()

# Initialize package-level logger
from ..utils.logger import logger

logger.info(
    "Knowledge Organization Models package initialized successfully",
    extra={
        "package_version": __version__,
        "node_types": len(NODE_LABEL_TYPES),
        "relationship_types": len(RELATIONSHIP_TYPES),
        "graph_types": len(GRAPH_TYPES)
    }
)