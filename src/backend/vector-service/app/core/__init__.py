"""
Core module initialization for the Vector Service.
Provides enterprise-grade vector operations with comprehensive monitoring and error handling.

External Dependencies:
logging==3.11+ - Enhanced logging capabilities
threading==3.11+ - Thread safety mechanisms
prometheus_client==0.17+ - Performance telemetry

Internal Dependencies:
EmbeddingGenerator - Vector embedding generation with health monitoring
SimilarityCalculator - Vector similarity calculation with monitoring
VectorIndexer - Vector indexing and storage with reliability checks
"""

import logging
import threading
from typing import Dict
from prometheus_client import Counter, Histogram

from .embedding_generator import EmbeddingGenerator
from .similarity_calculator import SimilarityCalculator
from .vector_indexer import VectorIndexer

# Version information
__version__ = "1.0.0"

# Define exports
__all__ = [
    "EmbeddingGenerator",
    "SimilarityCalculator", 
    "VectorIndexer",
    "health_check",
    "get_version"
]

# Configure logging
logger = logging.getLogger(__name__)

# Thread safety
_thread_lock = threading.Lock()

# Prometheus metrics
HEALTH_CHECK_DURATION = Histogram(
    'vector_service_health_check_duration_seconds',
    'Time spent performing health checks'
)
HEALTH_CHECK_FAILURES = Counter(
    'vector_service_health_check_failures_total',
    'Total number of health check failures'
)

@HEALTH_CHECK_DURATION.time()
def health_check() -> Dict:
    """
    Perform comprehensive health check of all vector service components.
    Implements thread-safe operation with performance monitoring.

    Returns:
        Dict: Aggregated health status of all components
        {
            'status': 'healthy'|'unhealthy',
            'timestamp': ISO8601 timestamp,
            'components': {
                'embedding_generator': {...},
                'similarity_calculator': {...},
                'vector_indexer': {...}
            }
        }

    Raises:
        RuntimeError: If health check fails critically
    """
    try:
        with _thread_lock:  # Ensure thread safety
            health_status = {
                'status': 'healthy',
                'timestamp': datetime.utcnow().isoformat(),
                'components': {}
            }

            # Check EmbeddingGenerator health
            try:
                generator_status = EmbeddingGenerator.health_check()
                health_status['components']['embedding_generator'] = generator_status
            except Exception as e:
                logger.error(f"EmbeddingGenerator health check failed: {str(e)}")
                health_status['components']['embedding_generator'] = {
                    'status': 'unhealthy',
                    'error': str(e)
                }
                health_status['status'] = 'unhealthy'

            # Check SimilarityCalculator health
            try:
                calculator_status = SimilarityCalculator.health_check()
                health_status['components']['similarity_calculator'] = calculator_status
            except Exception as e:
                logger.error(f"SimilarityCalculator health check failed: {str(e)}")
                health_status['components']['similarity_calculator'] = {
                    'status': 'unhealthy',
                    'error': str(e)
                }
                health_status['status'] = 'unhealthy'

            # Check VectorIndexer health
            try:
                indexer_status = VectorIndexer.health_check()
                health_status['components']['vector_indexer'] = indexer_status
            except Exception as e:
                logger.error(f"VectorIndexer health check failed: {str(e)}")
                health_status['components']['vector_indexer'] = {
                    'status': 'unhealthy',
                    'error': str(e)
                }
                health_status['status'] = 'unhealthy'

            # Update metrics
            if health_status['status'] == 'unhealthy':
                HEALTH_CHECK_FAILURES.inc()

            logger.info(
                "Health check completed",
                extra={
                    'status': health_status['status'],
                    'components_checked': len(health_status['components'])
                }
            )

            return health_status

    except Exception as e:
        logger.error(f"Critical health check failure: {str(e)}")
        HEALTH_CHECK_FAILURES.inc()
        raise RuntimeError(f"Health check failed: {str(e)}")

def get_version() -> str:
    """
    Return the current version of the vector service core.

    Returns:
        str: Current version string
    """
    return __version__

# Initialize logging
logger.info(
    f"Vector Service Core initialized (v{__version__})",
    extra={
        'components': ['EmbeddingGenerator', 'SimilarityCalculator', 'VectorIndexer']
    }
)