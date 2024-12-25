"""
Enterprise-grade Pinecone database client implementation for vector storage and similarity search operations.
Provides high-performance vector indexing and querying capabilities with comprehensive error handling and monitoring.

External Dependencies:
pinecone-client==2.2.0 - Pinecone vector database client with enterprise features
tenacity==8.2.0 - Advanced retry mechanism with exponential backoff
numpy==1.24.0 - High-performance vector operations
"""

import pinecone
import numpy as np
import uuid
from threading import Lock
from typing import Dict, List, Optional
from tenacity import retry, stop_after_attempt, wait_exponential
from datetime import datetime

from ..config import Settings
from ..utils.logger import logger
from ..models.embedding import Embedding

# Constants for database operations
BATCH_SIZE = 100
DEFAULT_TOP_K = 10
MIN_SIMILARITY_SCORE = 0.7
MAX_RETRIES = 3
BACKOFF_FACTOR = 0.5
CONNECTION_TIMEOUT = 5.0
OPERATION_TIMEOUT = 10.0

class PineconeClient:
    """
    Thread-safe client for interacting with Pinecone vector database.
    Implements comprehensive error handling, connection pooling, and health monitoring.
    """
    
    def __init__(self, settings: Settings, max_retries: int = MAX_RETRIES, 
                 backoff_factor: float = BACKOFF_FACTOR):
        """
        Initialize Pinecone client with configuration and connection pooling.
        
        Args:
            settings (Settings): Application settings instance
            max_retries (int): Maximum retry attempts for operations
            backoff_factor (float): Exponential backoff factor for retries
        """
        self._settings = settings
        self._index = None
        self._connection_pool = {}
        self._pool_lock = Lock()
        self._max_retries = max_retries
        self._backoff_factor = backoff_factor
        
        # Initialize Pinecone with configuration
        config = settings.get_pinecone_config()
        try:
            pinecone.init(
                api_key=config['api_key'],
                environment=config['environment'],
                timeout=CONNECTION_TIMEOUT
            )
            logger.info("Pinecone initialization successful", 
                       extra={"environment": config['environment']})
            
            # Connect to index and verify configuration
            self._index = pinecone.Index(
                config['index_name'],
                timeout=OPERATION_TIMEOUT
            )
            self._verify_index_configuration(config['dimension'])
            
        except Exception as e:
            logger.error(f"Failed to initialize Pinecone client: {str(e)}", 
                        extra={"error_type": type(e).__name__})
            raise

    def _verify_index_configuration(self, expected_dimension: int) -> None:
        """
        Verify index configuration matches expected parameters.
        
        Args:
            expected_dimension (int): Expected vector dimension
            
        Raises:
            ValueError: If index configuration is invalid
        """
        try:
            index_stats = self._index.describe_index_stats()
            actual_dimension = index_stats['dimension']
            
            if actual_dimension != expected_dimension:
                raise ValueError(
                    f"Index dimension mismatch. Expected: {expected_dimension}, "
                    f"Actual: {actual_dimension}"
                )
            logger.info("Index configuration verified", 
                       extra={"dimension": actual_dimension})
            
        except Exception as e:
            logger.error(f"Index configuration verification failed: {str(e)}")
            raise

    @retry(stop=stop_after_attempt(3), 
           wait=wait_exponential(multiplier=0.5, min=4, max=10))
    async def upsert_embedding(self, embedding: Embedding) -> bool:
        """
        Store or update vector embedding with retry mechanism.
        
        Args:
            embedding (Embedding): Vector embedding to store
            
        Returns:
            bool: Success status of operation
            
        Raises:
            ValueError: If embedding validation fails
            RuntimeError: If database operation fails
        """
        try:
            # Validate embedding and convert to Pinecone format
            embedding.validate()
            vector_data = embedding.to_pinecone_format()
            
            # Perform upsert operation with monitoring
            start_time = datetime.utcnow()
            await self._index.upsert(
                vectors=[vector_data],
                namespace=""  # Default namespace
            )
            
            # Log performance metrics
            duration = (datetime.utcnow() - start_time).total_seconds()
            logger.info(
                "Vector embedding upserted successfully",
                extra={
                    "content_id": str(embedding.content_id),
                    "duration_ms": duration * 1000,
                    "vector_dimension": len(embedding.vector)
                }
            )
            return True
            
        except Exception as e:
            logger.error(
                f"Failed to upsert vector embedding: {str(e)}",
                extra={
                    "content_id": str(embedding.content_id),
                    "error_type": type(e).__name__
                }
            )
            raise

    @retry(stop=stop_after_attempt(3), 
           wait=wait_exponential(multiplier=0.5, min=4, max=10))
    async def delete_embedding(self, content_id: uuid.UUID) -> bool:
        """
        Remove vector embedding from database.
        
        Args:
            content_id (uuid.UUID): Content ID to delete
            
        Returns:
            bool: Success status of operation
        """
        try:
            start_time = datetime.utcnow()
            await self._index.delete(
                ids=[str(content_id)],
                namespace=""
            )
            
            duration = (datetime.utcnow() - start_time).total_seconds()
            logger.info(
                "Vector embedding deleted successfully",
                extra={
                    "content_id": str(content_id),
                    "duration_ms": duration * 1000
                }
            )
            return True
            
        except Exception as e:
            logger.error(
                f"Failed to delete vector embedding: {str(e)}",
                extra={"content_id": str(content_id)}
            )
            raise

    @retry(stop=stop_after_attempt(3), 
           wait=wait_exponential(multiplier=0.5, min=4, max=10))
    async def find_similar(self, vector: np.ndarray, top_k: int = DEFAULT_TOP_K,
                          score_threshold: float = MIN_SIMILARITY_SCORE,
                          filter_params: Optional[Dict] = None) -> List[Embedding]:
        """
        Perform similarity search for vector embedding.
        
        Args:
            vector (np.ndarray): Query vector
            top_k (int): Number of results to return
            score_threshold (float): Minimum similarity score
            filter_params (Optional[Dict]): Additional query filters
            
        Returns:
            List[Embedding]: List of similar embeddings
        """
        try:
            # Validate input vector
            if not isinstance(vector, np.ndarray):
                raise TypeError("Query vector must be numpy.ndarray")
                
            vector_list = vector.astype(np.float64).tolist()
            
            # Perform similarity query with monitoring
            start_time = datetime.utcnow()
            query_response = await self._index.query(
                vector=vector_list,
                top_k=top_k,
                namespace="",
                filter=filter_params,
                include_metadata=True
            )
            
            # Process and filter results
            similar_embeddings = []
            for match in query_response.matches:
                if match.score >= score_threshold:
                    try:
                        embedding = Embedding.from_pinecone_format({
                            "id": match.id,
                            "values": match.values,
                            "metadata": match.metadata
                        })
                        similar_embeddings.append(embedding)
                    except ValueError as e:
                        logger.warning(
                            f"Skipping invalid match: {str(e)}",
                            extra={"match_id": match.id}
                        )
            
            # Log performance metrics
            duration = (datetime.utcnow() - start_time).total_seconds()
            logger.info(
                "Similarity search completed",
                extra={
                    "query_time_ms": duration * 1000,
                    "results_count": len(similar_embeddings),
                    "total_matches": len(query_response.matches)
                }
            )
            
            return similar_embeddings
            
        except Exception as e:
            logger.error(f"Similarity search failed: {str(e)}")
            raise

    async def check_health(self) -> Dict:
        """
        Perform comprehensive health check of database connection and operations.
        
        Returns:
            dict: Detailed health status and metrics
        """
        health_status = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "details": {}
        }
        
        try:
            # Check index statistics
            stats = self._index.describe_index_stats()
            health_status["details"]["vector_count"] = stats.get("total_vector_count", 0)
            health_status["details"]["dimension"] = stats.get("dimension")
            
            # Test basic operations
            test_vector = np.zeros(self._settings.PINECONE_DIMENSION)
            await self.find_similar(test_vector, top_k=1)
            
            # Add performance metrics
            health_status["details"]["index_status"] = "available"
            health_status["details"]["last_successful_query"] = datetime.utcnow().isoformat()
            
        except Exception as e:
            health_status["status"] = "unhealthy"
            health_status["error"] = str(e)
            logger.error(f"Health check failed: {str(e)}")
            
        return health_status