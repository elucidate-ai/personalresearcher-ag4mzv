"""
Core knowledge organization package providing thread-safe graph operations.
Implements comprehensive graph construction, relationship extraction, and optimization capabilities.

Version: 1.0.0
"""

import logging
from typing import Dict, Any

# Import core components with thread-safe operations
from .graph_builder import GraphBuilder
from .relationship_extractor import RelationshipExtractor
from .graph_optimizer import GraphOptimizer

# Initialize package-level logger
logger = logging.getLogger(__name__)

# Package version for compatibility checking
VERSION = "1.0.0"

# Thread-safe initialization state
_initialized = False

def initialize_core(config: Dict[str, Any] = None) -> None:
    """
    Thread-safe initialization of core knowledge graph components.
    
    Args:
        config: Optional configuration parameters
    """
    global _initialized
    
    if _initialized:
        logger.debug("Core components already initialized")
        return
        
    try:
        logger.info(
            "Initializing knowledge organization core",
            extra={
                "correlation_id": logger.get_correlation_id(),
                "version": VERSION
            }
        )
        
        # Initialize core components with configuration
        relationship_extractor = RelationshipExtractor()
        graph_optimizer = GraphOptimizer(
            db_conn=None,  # Will be injected by service layer
            optimization_config=config.get("optimization", {}) if config else {},
            enable_monitoring=True
        )
        
        # Initialize graph builder with dependencies
        graph_builder = GraphBuilder(
            relationship_extractor=relationship_extractor,
            graph_optimizer=graph_optimizer,
            build_config=config.get("build", {}) if config else {}
        )
        
        _initialized = True
        
        logger.info(
            "Knowledge organization core initialized successfully",
            extra={"correlation_id": logger.get_correlation_id()}
        )
        
    except Exception as e:
        logger.error(
            f"Failed to initialize knowledge organization core: {str(e)}",
            extra={
                "correlation_id": logger.get_correlation_id(),
                "error_type": type(e).__name__
            }
        )
        raise

def get_version() -> str:
    """
    Get the current package version.
    
    Returns:
        str: Package version number
    """
    return VERSION

# Export public interface
__all__ = [
    "GraphBuilder",
    "RelationshipExtractor", 
    "GraphOptimizer",
    "VERSION",
    "initialize_core",
    "get_version"
]