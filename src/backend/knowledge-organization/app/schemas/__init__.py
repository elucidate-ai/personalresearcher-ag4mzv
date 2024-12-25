"""
Enterprise-grade schema initialization module for the Knowledge Organization service.
Provides centralized access to all graph-related Pydantic schemas with comprehensive validation rules.

Version: 1.0.0
"""

from .graph import (
    NodeSchema,
    RelationshipSchema, 
    GraphSchema
)

# Version information
__version__ = "1.0.0"

# Export all schema classes for external use
__all__ = [
    "NodeSchema",
    "RelationshipSchema",
    "GraphSchema"
]

# Schema validation configuration
VALIDATION_CONFIG = {
    "arbitrary_types_allowed": True,
    "validate_assignment": True,
    "validate_all": True,
    "extra": "forbid"
}

# Configure all schemas with enterprise validation settings
for schema in [NodeSchema, RelationshipSchema, GraphSchema]:
    schema.Config.arbitrary_types_allowed = VALIDATION_CONFIG["arbitrary_types_allowed"]
    schema.Config.validate_assignment = VALIDATION_CONFIG["validate_assignment"]
    schema.Config.validate_all = VALIDATION_CONFIG["validate_all"]
    schema.Config.extra = VALIDATION_CONFIG["extra"]

# Documentation for exported schemas
NodeSchema.__doc__ = """
Enterprise-grade schema for validating knowledge graph nodes.
Provides comprehensive validation rules for node data with Neo4j compatibility.

Validation Rules:
- Validates node label against allowed types
- Ensures proper UUID format for node ID
- Validates importance score range (0.0 to 1.0)
- Enforces proper timestamp formats
- Sanitizes node properties
"""

RelationshipSchema.__doc__ = """
Enterprise-grade schema for validating knowledge graph relationships.
Provides comprehensive validation rules for relationship data with Neo4j compatibility.

Validation Rules:
- Validates relationship type against allowed types
- Ensures proper UUID format for relationship ID
- Validates weight range (0.0 to 1.0)
- Enforces proper timestamp formats
- Validates source and target node existence
- Prevents self-referential relationships
"""

GraphSchema.__doc__ = """
Enterprise-grade schema for validating complete knowledge graphs.
Provides comprehensive validation rules for entire graph structures with Neo4j compatibility.

Validation Rules:
- Validates graph type against allowed types
- Ensures proper UUID format for graph ID
- Validates all nodes and relationships
- Enforces graph consistency rules
- Detects and prevents cycles in prerequisite graphs
- Validates structural integrity of the graph
"""