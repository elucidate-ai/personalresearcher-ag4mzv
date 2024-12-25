"""
Vector service models package providing core data models for vector representation and management.
This package exports the Embedding model for semantic search and content clustering capabilities.

External Dependencies:
numpy==1.24.0 - Required by Embedding model for vector operations

Internal Dependencies:
config - Thread-safe access to vector dimension configuration
"""

from .embedding import Embedding

# Define public exports
__all__ = ['Embedding']

# Version information
__version__ = '1.0.0'

# Package metadata
__package_name__ = 'vector-service-models'
__author__ = 'Knowledge Aggregation System'
__description__ = 'Enterprise-grade vector embedding models for semantic search and content clustering'

# Validate critical dependencies on import
def _validate_dependencies():
    """
    Validates critical package dependencies are available with correct versions.
    Raises ImportError if validation fails.
    """
    try:
        import numpy as np
        numpy_version = np.__version__
        if not numpy_version.startswith('1.24'):
            raise ImportError(
                f"Incompatible numpy version {numpy_version}. Required: 1.24.x"
            )
    except ImportError as e:
        raise ImportError(f"Failed to validate dependencies: {str(e)}")

# Perform validation on package import
_validate_dependencies()