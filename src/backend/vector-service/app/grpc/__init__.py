"""
Initialization module for the vector service gRPC package that exports core gRPC components
and server functionality with optimized lazy loading and comprehensive type safety.

External Dependencies:
importlib (built-in) - Dynamic module loading
logging (built-in) - Package initialization logging
functools (built-in) - Function utilities

Version: 1.0.0
"""

import logging
import functools
import importlib
from typing import Any

# Initialize package-level logger
logger = logging.getLogger(__name__)

# Package version
__version__ = '1.0.0'

# Define exports
__all__ = [
    'VectorServiceImpl',
    'serve',
    'EmbeddingRequest',
    'EmbeddingResponse', 
    'SearchRequest',
    'SearchResponse'
]

@functools.lru_cache(maxsize=None)
def _lazy_load_proto(module_name: str, class_name: str) -> Any:
    """
    Lazily loads protocol buffer message classes when first accessed.
    Uses caching to optimize subsequent access.

    Args:
        module_name (str): Name of the proto module
        class_name (str): Name of the class to load

    Returns:
        Any: Dynamically loaded protocol buffer message class

    Raises:
        ImportError: If module or class cannot be loaded
    """
    try:
        module = importlib.import_module(f".{module_name}", package="app.grpc")
        return getattr(module, class_name)
    except (ImportError, AttributeError) as e:
        logger.error(f"Failed to load proto class {class_name}: {str(e)}")
        raise ImportError(f"Could not load {class_name} from {module_name}") from e

# Lazy load server implementation
def VectorServiceImpl():
    """Lazy load the VectorServiceImpl class."""
    from .server import VectorServiceImpl as Impl
    return Impl

# Lazy load server function
def serve(*args, **kwargs):
    """Lazy load and invoke the serve function."""
    from .server import serve as serve_fn
    return serve_fn(*args, **kwargs)

# Lazy load proto message classes
def EmbeddingRequest():
    """Lazy load the EmbeddingRequest message class."""
    return _lazy_load_proto("vector_pb2", "EmbeddingRequest")

def EmbeddingResponse():
    """Lazy load the EmbeddingResponse message class."""
    return _lazy_load_proto("vector_pb2", "EmbeddingResponse")

def SearchRequest():
    """Lazy load the SearchRequest message class."""
    return _lazy_load_proto("vector_pb2", "SearchRequest")

def SearchResponse():
    """Lazy load the SearchResponse message class."""
    return _lazy_load_proto("vector_pb2", "SearchResponse")

# Initialize logging
logger.info(
    "Vector service gRPC package initialized",
    extra={
        "version": __version__,
        "exports": __all__
    }
)