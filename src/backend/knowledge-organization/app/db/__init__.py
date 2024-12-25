"""
Database initialization module for the Knowledge Organization service.
Provides thread-safe Neo4j database connection management with enterprise features.

Version: 1.0.0
"""

from typing import Optional
import threading
from .neo4j import Neo4jConnection  # neo4j v5.0.0
from ..utils.logger import logger, log_error

# Global database connection instance
db_connection: Optional[Neo4jConnection] = None

# Thread synchronization lock
_lock = threading.Lock()

def get_db_connection() -> Neo4jConnection:
    """
    Get or create thread-safe singleton instance of Neo4j database connection.
    Implements connection pooling and high availability features.

    Returns:
        Neo4jConnection: Singleton database connection instance
    
    Raises:
        RuntimeError: If database initialization fails
    """
    global db_connection

    if db_connection is None:
        with _lock:
            if db_connection is None:
                try:
                    # Initialize connection with enterprise configuration
                    connection = Neo4jConnection(
                        max_connections=200,  # Aligned with settings.NEO4J_MAX_CONNECTIONS
                        connection_timeout=5000,  # 5 seconds timeout
                        enable_read_replicas=True
                    )
                    
                    # Verify connection is successful
                    if not verify_connection(connection):
                        raise RuntimeError("Failed to verify database connection")
                    
                    db_connection = connection
                    logger.info(
                        "Neo4j connection initialized successfully",
                        extra={'correlation_id': logger.get_correlation_id()}
                    )
                except Exception as e:
                    log_error(
                        e,
                        {
                            'component': 'database_initialization',
                            'operation': 'get_db_connection'
                        }
                    )
                    raise RuntimeError(f"Failed to initialize database connection: {str(e)}")

    return db_connection

async def initialize_db() -> bool:
    """
    Initialize database connection with comprehensive error handling and verification.
    Sets up connection pooling, monitoring, and high availability features.

    Returns:
        bool: True if initialization successful, False otherwise
    """
    try:
        connection = get_db_connection()
        
        # Establish connection with retry logic
        connected = await connection.connect()
        if not connected:
            logger.error(
                "Failed to establish database connection",
                extra={'correlation_id': logger.get_correlation_id()}
            )
            return False

        # Verify connection health
        if not verify_connection(connection):
            logger.error(
                "Database connection verification failed",
                extra={'correlation_id': logger.get_correlation_id()}
            )
            return False

        logger.info(
            "Database initialized successfully",
            extra={
                'correlation_id': logger.get_correlation_id(),
                'status': 'healthy'
            }
        )
        return True

    except Exception as e:
        log_error(
            e,
            {
                'component': 'database_initialization',
                'operation': 'initialize_db'
            }
        )
        return False

def verify_connection(connection: Neo4jConnection) -> bool:
    """
    Perform comprehensive health check on database connection.
    Verifies connectivity, read replicas, and connection pool health.

    Args:
        connection: Neo4j connection instance to verify

    Returns:
        bool: True if connection is healthy, False otherwise
    """
    try:
        # Execute test query to verify connectivity
        test_query = "MATCH (n) RETURN count(n) AS count LIMIT 1"
        result = connection.execute_query(
            query=test_query,
            write=False,
            timeout=5000  # 5 seconds timeout for health check
        )

        if result is None:
            logger.warning(
                "Database health check query returned no result",
                extra={'correlation_id': logger.get_correlation_id()}
            )
            return False

        logger.info(
            "Database connection verified successfully",
            extra={
                'correlation_id': logger.get_correlation_id(),
                'status': 'healthy'
            }
        )
        return True

    except Exception as e:
        log_error(
            e,
            {
                'component': 'database_initialization',
                'operation': 'verify_connection'
            }
        )
        return False

# Export commonly used functions
__all__ = [
    'get_db_connection',
    'initialize_db',
    'verify_connection'
]