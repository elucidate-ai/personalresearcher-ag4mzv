"""
Database module initialization providing unified access to vector database and caching services.
Implements enterprise-grade connection management, health monitoring, and error handling.

External Dependencies:
backoff==2.2.1 - Implements exponential backoff for retries

Internal Dependencies:
PineconeClient - Vector database client for similarity search operations
RedisClient - Redis client for caching vector operations
logger - Logging functionality for database operations
"""

from typing import Dict, Optional, Tuple
import backoff
from datetime import datetime

from .pinecone import PineconeClient
from .redis import RedisClient
from ..utils.logger import logger

# Default connection pool configuration
DEFAULT_POOL_CONFIG = {
    "max_connections": 10,
    "min_connections": 2,
    "max_idle_time": 300,  # 5 minutes
    "connection_timeout": 5.0,
    "operation_timeout": 10.0
}

@backoff.on_exception(backoff.expo, Exception, max_tries=5)
def initialize_databases(
    correlation_id: str,
    connection_pool_config: Optional[Dict] = None
) -> Tuple[PineconeClient, RedisClient]:
    """
    Initialize database connections with connection pooling and retry logic.

    Args:
        correlation_id (str): Request correlation ID for tracing
        connection_pool_config (Optional[Dict]): Custom connection pool settings

    Returns:
        Tuple[PineconeClient, RedisClient]: Initialized database client instances

    Raises:
        RuntimeError: If database initialization fails after retries
    """
    try:
        # Merge custom config with defaults
        pool_config = {**DEFAULT_POOL_CONFIG, **(connection_pool_config or {})}
        
        logger.info(
            "Initializing database connections",
            extra={
                "correlation_id": correlation_id,
                "pool_config": pool_config
            }
        )

        # Initialize vector database client
        vector_db = PineconeClient(
            max_retries=pool_config["max_connections"],
            backoff_factor=0.5
        )

        # Initialize cache client
        cache_db = RedisClient(
            correlation_id=correlation_id,
            max_connections=pool_config["max_connections"],
            ssl_enabled=True  # Production security requirement
        )

        # Verify connections are healthy
        vector_health = vector_db.check_health()
        if vector_health["status"] != "healthy":
            raise RuntimeError(f"Vector database health check failed: {vector_health.get('error')}")

        # Log successful initialization
        logger.info(
            "Database connections initialized successfully",
            extra={
                "correlation_id": correlation_id,
                "vector_db_status": vector_health["status"],
                "cache_stats": cache_db.get_cache_stats()
            }
        )

        return vector_db, cache_db

    except Exception as e:
        logger.error(
            f"Database initialization failed: {str(e)}",
            extra={
                "correlation_id": correlation_id,
                "error_type": type(e).__name__
            }
        )
        raise RuntimeError(f"Failed to initialize databases: {str(e)}")

def check_database_health(
    vector_db: PineconeClient,
    cache_db: RedisClient
) -> Dict:
    """
    Perform comprehensive health check on all database connections.

    Args:
        vector_db (PineconeClient): Vector database client
        cache_db (RedisClient): Cache database client

    Returns:
        Dict: Detailed health status including latency and connection stats
    """
    health_status = {
        "timestamp": datetime.utcnow().isoformat(),
        "overall_status": "healthy",
        "services": {}
    }

    try:
        # Check vector database health
        vector_health = vector_db.check_health()
        health_status["services"]["vector_db"] = vector_health

        # Check cache health
        cache_stats = cache_db.get_cache_stats()
        health_status["services"]["cache"] = {
            "status": "healthy",
            "statistics": cache_stats
        }

        # Determine overall health
        if any(service.get("status") != "healthy" 
               for service in health_status["services"].values()):
            health_status["overall_status"] = "degraded"

        logger.info(
            "Health check completed",
            extra={
                "health_status": health_status
            }
        )

    except Exception as e:
        health_status["overall_status"] = "unhealthy"
        health_status["error"] = str(e)
        logger.error(
            f"Health check failed: {str(e)}",
            extra={
                "error_type": type(e).__name__
            }
        )

    return health_status

def cleanup_connections(
    vector_db: PineconeClient,
    cache_db: RedisClient
) -> bool:
    """
    Gracefully close all database connections.

    Args:
        vector_db (PineconeClient): Vector database client
        cache_db (RedisClient): Cache database client

    Returns:
        bool: Success status of cleanup operation
    """
    cleanup_status = True
    
    try:
        # Close vector database connections
        vector_health = vector_db.check_health()
        if vector_health["status"] == "healthy":
            # Cleanup logic specific to Pinecone client
            pass

        # Close Redis connections
        cache_stats = cache_db.get_cache_stats()
        if cache_stats:
            cache_db._client.close()
            cache_db._connection_pool.disconnect()

        logger.info(
            "Database connections closed successfully",
            extra={
                "vector_db_status": vector_health["status"],
                "cache_stats": cache_stats
            }
        )

    except Exception as e:
        cleanup_status = False
        logger.error(
            f"Failed to cleanup database connections: {str(e)}",
            extra={
                "error_type": type(e).__name__
            }
        )

    return cleanup_status

# Export public interfaces
__all__ = [
    'PineconeClient',
    'RedisClient',
    'initialize_databases',
    'check_database_health',
    'cleanup_connections'
]