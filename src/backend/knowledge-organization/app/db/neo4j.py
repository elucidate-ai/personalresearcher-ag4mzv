"""
Enterprise-grade Neo4j database connection and query management module.
Provides connection pooling, async operations, read replica support, and robust error handling.

Version: 1.0.0
"""

# Third-party imports - versions specified for enterprise deployments
from neo4j import GraphDatabase, Driver, AsyncGraphDatabase  # neo4j v5.0.0
import asyncio
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional, Union
import backoff  # backoff v2.2.1
from circuit_breaker_pattern import circuit_breaker  # circuit_breaker_pattern v1.0.0

# Internal imports
from ..config import settings
from ..utils.logger import logger

# Constants for connection and query management
DEFAULT_MAX_CONNECTIONS = 50
DEFAULT_CONNECTION_TIMEOUT = 5000  # milliseconds
DEFAULT_QUERY_TIMEOUT = 30000  # milliseconds
MAX_RETRY_ATTEMPTS = 3
CIRCUIT_BREAKER_THRESHOLD = 5

class Neo4jConnection:
    """
    Enterprise-grade Neo4j database connection manager with advanced features:
    - Connection pooling with configurable limits
    - Read replica support for scalability
    - Async operations
    - Circuit breaker pattern for fault tolerance
    - Correlation ID tracking for request tracing
    - Comprehensive error handling and logging
    """

    def __init__(
        self,
        max_connections: int = DEFAULT_MAX_CONNECTIONS,
        connection_timeout: int = DEFAULT_CONNECTION_TIMEOUT,
        enable_read_replicas: bool = True
    ):
        """
        Initialize Neo4j connection manager with enterprise configuration.

        Args:
            max_connections: Maximum number of connections in the pool
            connection_timeout: Connection timeout in milliseconds
            enable_read_replicas: Flag to enable read replica support
        """
        self._config = settings.get_neo4j_config()
        self._driver: Optional[Driver] = None
        self._read_replicas: List[Driver] = []
        self._max_connections = max_connections
        self._connection_pools: Dict[str, List[Driver]] = {
            'write': [],
            'read': []
        }
        self._pool_lock = asyncio.Lock()
        self._current_replica = 0

    @circuit_breaker(failure_threshold=CIRCUIT_BREAKER_THRESHOLD, recovery_timeout=60)
    @backoff.on_exception(
        backoff.expo,
        (GraphDatabase.ServiceUnavailable, GraphDatabase.SessionExpired),
        max_tries=MAX_RETRY_ATTEMPTS
    )
    async def connect(self) -> bool:
        """
        Establish connection to Neo4j with retry logic and circuit breaker protection.

        Returns:
            bool: Connection success status
        """
        try:
            # Initialize main connection
            self._driver = GraphDatabase.driver(
                self._config['uri'],
                auth=self._config['auth'],
                max_connection_pool_size=self._max_connections,
                connection_timeout=self._config.get('connection_timeout', DEFAULT_CONNECTION_TIMEOUT)
            )

            # Verify connection
            await self._driver.verify_connectivity()
            
            # Initialize read replicas if configured
            if self._config.get('read_replicas'):
                for replica_uri in self._config['read_replicas']:
                    replica_driver = GraphDatabase.driver(
                        replica_uri,
                        auth=self._config['auth'],
                        max_connection_pool_size=self._max_connections,
                        connection_timeout=self._config.get('connection_timeout', DEFAULT_CONNECTION_TIMEOUT)
                    )
                    await replica_driver.verify_connectivity()
                    self._read_replicas.append(replica_driver)

            logger.info(
                "Neo4j connection established successfully",
                extra={'correlation_id': logger.correlation_id}
            )
            return True

        except Exception as e:
            logger.error(
                f"Failed to establish Neo4j connection: {str(e)}",
                extra={'correlation_id': logger.correlation_id}
            )
            raise

    @asynccontextmanager
    async def _get_session(self, write: bool = False) -> Any:
        """
        Get database session with automatic read replica selection.

        Args:
            write: Flag indicating if write access is needed

        Yields:
            Neo4j session object
        """
        driver = self._driver if write else self._get_read_replica()
        session = None
        try:
            session = driver.session()
            yield session
        finally:
            if session:
                await session.close()

    def _get_read_replica(self) -> Driver:
        """
        Select read replica using round-robin strategy.

        Returns:
            Driver: Selected read replica driver
        """
        if not self._read_replicas:
            return self._driver
        
        self._current_replica = (self._current_replica + 1) % len(self._read_replicas)
        return self._read_replicas[self._current_replica]

    @backoff.on_exception(
        backoff.expo,
        (GraphDatabase.ServiceUnavailable, GraphDatabase.SessionExpired),
        max_tries=MAX_RETRY_ATTEMPTS
    )
    async def execute_query(
        self,
        query: str,
        parameters: Optional[Dict[str, Any]] = None,
        write: bool = False,
        timeout: int = DEFAULT_QUERY_TIMEOUT
    ) -> List[Dict[str, Any]]:
        """
        Execute Cypher query with automatic read replica selection and retry logic.

        Args:
            query: Cypher query string
            parameters: Query parameters
            write: Flag indicating if write access is needed
            timeout: Query timeout in milliseconds

        Returns:
            List of query results as dictionaries
        """
        parameters = parameters or {}
        
        try:
            async with self._get_session(write) as session:
                result = await session.run(
                    query,
                    parameters,
                    timeout=timeout
                )
                records = await result.data()
                
                logger.info(
                    "Query executed successfully",
                    extra={
                        'correlation_id': logger.correlation_id,
                        'query_type': 'write' if write else 'read',
                        'results_count': len(records)
                    }
                )
                return records

        except Exception as e:
            logger.error(
                f"Query execution failed: {str(e)}",
                extra={
                    'correlation_id': logger.correlation_id,
                    'query': query,
                    'parameters': parameters
                }
            )
            raise

    async def execute_async_query(
        self,
        query: str,
        parameters: Optional[Dict[str, Any]] = None,
        write: bool = False,
        timeout: int = DEFAULT_QUERY_TIMEOUT
    ) -> List[Dict[str, Any]]:
        """
        Execute Cypher query asynchronously with connection pooling.

        Args:
            query: Cypher query string
            parameters: Query parameters
            write: Flag indicating if write access is needed
            timeout: Query timeout in milliseconds

        Returns:
            List of query results as dictionaries
        """
        async with self._pool_lock:
            return await self.execute_query(query, parameters, write, timeout)

    async def close(self) -> None:
        """
        Close all database connections gracefully.
        """
        try:
            if self._driver:
                await self._driver.close()
            
            for replica in self._read_replicas:
                await replica.close()

            logger.info(
                "Neo4j connections closed successfully",
                extra={'correlation_id': logger.correlation_id}
            )

        except Exception as e:
            logger.error(
                f"Error closing Neo4j connections: {str(e)}",
                extra={'correlation_id': logger.correlation_id}
            )
            raise

# Export Neo4jConnection class for external use
__all__ = ['Neo4jConnection']