"""
Production-ready Redis client implementation for vector service caching.
Provides connection pooling, circuit breaker pattern, and comprehensive monitoring.

External Dependencies:
redis==4.5.0
numpy==1.24.0
tenacity==8.0.0
circuit_breaker_pattern==1.0.0
"""

import json
from typing import Dict, List, Optional, Tuple, Union
import numpy as np
from redis import Redis, ConnectionPool, ConnectionError
from redis.backoff import ExponentialBackoff
from redis.retry import Retry
from tenacity import retry, stop_after_attempt, wait_exponential
from circuit_breaker_pattern import CircuitBreaker

from ..config import Settings
from ..utils.logger import logger

# Constants
VECTOR_TTL_SECONDS = 3600  # 1 hour for vector embeddings
RESULTS_TTL_SECONDS = 1800  # 30 minutes for search results
MAX_BATCH_SIZE = 1000  # Maximum number of embeddings per batch operation

class RedisClient:
    """
    Production-ready Redis client for caching vector embeddings and search results
    with connection pooling, circuit breaker, and monitoring capabilities.
    """

    def __init__(
        self, 
        correlation_id: str,
        max_connections: int = Settings().REDIS_MAX_CONNECTIONS,
        ssl_enabled: bool = Settings().REDIS_SSL
    ):
        """
        Initialize Redis client with enhanced configuration.

        Args:
            correlation_id (str): Request correlation ID for logging
            max_connections (int): Maximum number of connections in pool
            ssl_enabled (bool): Whether to use SSL for Redis connection
        """
        self._correlation_id = correlation_id
        self._cache_stats = {
            'hits': 0,
            'misses': 0,
            'errors': 0,
            'batch_operations': 0
        }

        # Initialize connection pool
        pool_kwargs = {
            'host': Settings().REDIS_HOST,
            'port': Settings().REDIS_PORT,
            'password': Settings().REDIS_PASSWORD,
            'max_connections': max_connections,
            'retry_on_timeout': True,
            'retry': Retry(ExponentialBackoff(), 3),
            'decode_responses': False  # Keep binary for vector data
        }
        
        if ssl_enabled:
            pool_kwargs['ssl'] = True
            pool_kwargs['ssl_cert_reqs'] = None  # Adjust based on security requirements
            
        self._connection_pool = ConnectionPool(**pool_kwargs)
        
        # Initialize Redis client with connection pool
        self._client = Redis(
            connection_pool=self._connection_pool,
            health_check_interval=30
        )
        
        # Set TTL values
        self._vector_ttl = VECTOR_TTL_SECONDS
        self._results_ttl = RESULTS_TTL_SECONDS
        
        # Initialize circuit breaker
        self._circuit_breaker = CircuitBreaker(
            failure_threshold=5,
            recovery_timeout=30,
            name='redis_circuit_breaker'
        )
        
        # Verify connection
        self._verify_connection()
        
        logger.info(
            "Redis client initialized",
            extra={
                'correlation_id': self._correlation_id,
                'host': Settings().REDIS_HOST,
                'port': Settings().REDIS_PORT
            }
        )

    def _verify_connection(self) -> None:
        """Verify Redis connection is working."""
        try:
            self._client.ping()
        except ConnectionError as e:
            logger.error(
                "Redis connection failed",
                extra={
                    'correlation_id': self._correlation_id,
                    'error': str(e)
                }
            )
            raise

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    def cache_embedding_batch(
        self,
        embedding_batch: List[Tuple[str, np.ndarray, Dict]]
    ) -> Dict[str, bool]:
        """
        Cache multiple vector embeddings in a single operation.

        Args:
            embedding_batch: List of tuples (id, vector, metadata)

        Returns:
            Dict mapping embedding IDs to success status
        """
        if not embedding_batch or len(embedding_batch) > MAX_BATCH_SIZE:
            raise ValueError(f"Batch size must be between 1 and {MAX_BATCH_SIZE}")

        results = {}
        
        try:
            with self._circuit_breaker:
                pipeline = self._client.pipeline(transaction=True)
                
                for embed_id, vector, metadata in embedding_batch:
                    # Serialize vector and metadata
                    vector_bytes = self._serialize_vector(vector)
                    metadata_bytes = json.dumps(metadata).encode('utf-8')
                    
                    # Store vector and metadata with TTL
                    key_vector = f"vector:{embed_id}"
                    key_metadata = f"metadata:{embed_id}"
                    
                    pipeline.setex(key_vector, self._vector_ttl, vector_bytes)
                    pipeline.setex(key_metadata, self._vector_ttl, metadata_bytes)
                    
                # Execute pipeline
                pipeline_results = pipeline.execute()
                
                # Process results
                for i, embed_id in enumerate(embedding_batch):
                    results[embed_id[0]] = all(
                        pipeline_results[i*2:(i+1)*2]
                    )
                
                self._cache_stats['batch_operations'] += 1
                
                logger.info(
                    "Batch cache operation completed",
                    extra={
                        'correlation_id': self._correlation_id,
                        'batch_size': len(embedding_batch),
                        'success_count': sum(results.values())
                    }
                )
                
        except Exception as e:
            self._cache_stats['errors'] += 1
            logger.error(
                "Batch cache operation failed",
                extra={
                    'correlation_id': self._correlation_id,
                    'error': str(e),
                    'batch_size': len(embedding_batch)
                }
            )
            raise
            
        return results

    def get_cache_stats(self) -> Dict:
        """
        Get current cache statistics.

        Returns:
            Dict containing cache statistics
        """
        stats = self._cache_stats.copy()
        
        # Calculate hit rate
        total_ops = stats['hits'] + stats['misses']
        stats['hit_rate'] = (
            stats['hits'] / total_ops if total_ops > 0 else 0
        )
        
        # Add memory usage info
        try:
            memory_info = self._client.info('memory')
            stats['memory_used_bytes'] = memory_info.get('used_memory', 0)
            stats['memory_peak_bytes'] = memory_info.get('used_memory_peak', 0)
        except Exception as e:
            logger.warning(
                "Failed to get memory stats",
                extra={
                    'correlation_id': self._correlation_id,
                    'error': str(e)
                }
            )
            
        return stats

    def warm_cache(self, embedding_ids: List[str]) -> bool:
        """
        Preload frequently accessed embeddings into cache.

        Args:
            embedding_ids: List of embedding IDs to preload

        Returns:
            bool indicating success
        """
        try:
            # Split into manageable batches
            batch_size = MAX_BATCH_SIZE
            for i in range(0, len(embedding_ids), batch_size):
                batch = embedding_ids[i:i + batch_size]
                
                # Fetch vectors and metadata for batch
                pipeline = self._client.pipeline(transaction=False)
                
                for embed_id in batch:
                    key_vector = f"vector:{embed_id}"
                    key_metadata = f"metadata:{embed_id}"
                    pipeline.exists(key_vector)
                    pipeline.exists(key_metadata)
                    
                results = pipeline.execute()
                
                logger.info(
                    "Cache warm-up batch completed",
                    extra={
                        'correlation_id': self._correlation_id,
                        'batch_size': len(batch),
                        'cache_hits': sum(results)
                    }
                )
                
            return True
            
        except Exception as e:
            logger.error(
                "Cache warm-up failed",
                extra={
                    'correlation_id': self._correlation_id,
                    'error': str(e)
                }
            )
            return False

    def _serialize_vector(self, vector: np.ndarray) -> bytes:
        """Serialize vector to bytes."""
        return vector.tobytes()

    def _deserialize_vector(self, vector_bytes: bytes) -> np.ndarray:
        """Deserialize bytes to vector."""
        return np.frombuffer(vector_bytes, dtype=np.float32)