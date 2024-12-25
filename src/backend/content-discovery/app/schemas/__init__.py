"""
Entry point for Pydantic schema exports in the content discovery service.
Provides centralized access to content and topic validation schemas with versioning support.

Version: 1.0.0
"""

# External imports with versions specified for security and compatibility
from typing import List  # latest

# Internal imports with schema versioning support
from .content import (  # ^1.0.0
    ContentBase,
    ContentCreate, 
    ContentUpdate,
    ContentResponse,
    ContentList
)
from .topic import (  # ^1.0.0
    TopicBase,
    TopicCreate,
    TopicUpdate,
    TopicResponse,
    TopicList
)

# Schema version tracking for API compatibility
SCHEMA_VERSION = "1.0.0"

# Track deprecated schemas for migration support
DEPRECATED_SCHEMAS: List[str] = []

# Export content-related schemas with version tracking
__all__ = [
    # Content schemas
    "ContentBase",  # Base schema for content validation
    "ContentCreate",  # Schema for content creation
    "ContentUpdate",  # Schema for content updates
    "ContentResponse",  # Schema for content API responses
    "ContentList",  # Schema for paginated content lists
    
    # Topic schemas
    "TopicBase",  # Base schema for topic validation
    "TopicCreate",  # Schema for topic creation
    "TopicUpdate",  # Schema for topic updates 
    "TopicResponse",  # Schema for topic API responses
    "TopicList",  # Schema for paginated topic lists
    
    # Version information
    "SCHEMA_VERSION",  # Current schema version
    "DEPRECATED_SCHEMAS"  # List of deprecated schema versions
]

# Schema version validation
def validate_schema_version(version: str) -> bool:
    """
    Validates if a schema version is current or deprecated.
    
    Args:
        version: Schema version to validate
        
    Returns:
        bool indicating if version is valid
    """
    if version == SCHEMA_VERSION:
        return True
    return version in DEPRECATED_SCHEMAS

# Schema migration support
def get_schema_migrations(from_version: str, to_version: str = SCHEMA_VERSION) -> List[str]:
    """
    Returns list of required migrations between schema versions.
    
    Args:
        from_version: Source schema version
        to_version: Target schema version (defaults to current)
        
    Returns:
        List of migration steps required
        
    Raises:
        ValueError: If migration path is invalid
    """
    if from_version == to_version:
        return []
    
    if from_version in DEPRECATED_SCHEMAS:
        # Return migration path from deprecated to current version
        # This will be expanded as schema versions evolve
        return [f"Migrate from {from_version} to {SCHEMA_VERSION}"]
        
    raise ValueError(f"Invalid schema version: {from_version}")