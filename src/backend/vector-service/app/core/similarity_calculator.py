"""
Enterprise-grade similarity calculator for vector embeddings with comprehensive optimization,
error handling, and monitoring capabilities.

External Dependencies:
numpy==1.24.0 - High-performance vector operations
scipy==1.10.0 - Advanced similarity metrics
tenacity==8.2.0 - Robust retry mechanism
concurrent.futures (built-in) - Parallel processing

Internal Dependencies:
models.embedding - Vector embedding data model
db.pinecone - Vector database operations
utils.logger - Logging functionality
"""

import numpy as np
from scipy.spatial.distance import cosine, euclidean, cityblock
from scipy.spatial import distance
from tenacity import retry, stop_after_attempt, wait_exponential
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from typing import List, Dict, Tuple, Optional
from functools import lru_cache

from ..models.embedding import Embedding
from ..db.pinecone import PineconeClient
from ..utils.logger import logger

# Global constants
DEFAULT_SIMILARITY_METRIC = "cosine"
DEFAULT_SIMILARITY_THRESHOLD = 0.7
SUPPORTED_METRICS = ["cosine", "euclidean", "dot_product", "manhattan"]
MAX_VECTOR_DIMENSION = 1024
MAX_BATCH_SIZE = 1000
CACHE_SIZE = 10000

class SimilarityCalculator:
    """
    Thread-safe calculator for vector similarity operations with support for multiple metrics,
    batch processing, and performance optimization.
    """
    
    def __init__(
        self,
        pinecone_client: PineconeClient,
        metric: str = DEFAULT_SIMILARITY_METRIC,
        threshold: float = DEFAULT_SIMILARITY_THRESHOLD,
        max_workers: int = 4
    ) -> None:
        """
        Initialize similarity calculator with specified configuration.

        Args:
            pinecone_client: Vector database client instance
            metric: Similarity metric to use
            threshold: Minimum similarity threshold
            max_workers: Maximum thread pool workers
        """
        if metric not in SUPPORTED_METRICS:
            raise ValueError(f"Unsupported similarity metric: {metric}")
            
        if not 0 <= threshold <= 1:
            raise ValueError("Threshold must be between 0 and 1")
            
        self._pinecone_client = pinecone_client
        self._metric = metric
        self._threshold = threshold
        self._executor = ThreadPoolExecutor(max_workers=max_workers)
        self._lock = Lock()
        self._cache = {}
        
        # Set random seed for reproducibility
        np.random.seed(42)
        
        logger.info(
            "Initialized SimilarityCalculator",
            extra={
                "metric": metric,
                "threshold": threshold,
                "max_workers": max_workers
            }
        )

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, min=4, max=10)
    )
    def calculate_similarity(
        self,
        vector1: np.ndarray,
        vector2: np.ndarray
    ) -> float:
        """
        Calculate similarity between two vectors with caching and validation.

        Args:
            vector1: First vector for comparison
            vector2: Second vector for comparison

        Returns:
            float: Normalized similarity score between 0 and 1

        Raises:
            ValueError: If vector dimensions don't match
            TypeError: If inputs are not numpy arrays
        """
        with self._lock:
            try:
                # Input validation
                if not isinstance(vector1, np.ndarray) or not isinstance(vector2, np.ndarray):
                    raise TypeError("Inputs must be numpy arrays")
                    
                if vector1.shape != vector2.shape:
                    raise ValueError("Vector dimensions must match")
                    
                if vector1.shape[0] > MAX_VECTOR_DIMENSION:
                    raise ValueError(f"Vector dimension exceeds maximum: {MAX_VECTOR_DIMENSION}")
                
                # Check cache
                cache_key = (vector1.tobytes(), vector2.tobytes())
                if cache_key in self._cache:
                    return self._cache[cache_key]
                
                # Normalize vectors
                vector1_norm = vector1 / np.linalg.norm(vector1)
                vector2_norm = vector2 / np.linalg.norm(vector2)
                
                # Calculate similarity based on metric
                if self._metric == "cosine":
                    score = 1 - cosine(vector1_norm, vector2_norm)
                elif self._metric == "euclidean":
                    score = 1 / (1 + euclidean(vector1_norm, vector2_norm))
                elif self._metric == "manhattan":
                    score = 1 / (1 + cityblock(vector1_norm, vector2_norm))
                else:  # dot_product
                    score = np.dot(vector1_norm, vector2_norm)
                
                # Apply threshold
                score = max(0.0, min(1.0, score))
                if score < self._threshold:
                    score = 0.0
                
                # Cache result
                self._cache[cache_key] = score
                
                logger.debug(
                    "Calculated vector similarity",
                    extra={
                        "metric": self._metric,
                        "score": score,
                        "vector_dim": vector1.shape[0]
                    }
                )
                
                return score
                
            except Exception as e:
                logger.error(
                    f"Similarity calculation failed: {str(e)}",
                    extra={"error_type": type(e).__name__}
                )
                raise

    async def find_similar_vectors(
        self,
        query_vector: np.ndarray,
        top_k: int = 10,
        filters: Optional[Dict] = None
    ) -> List[Tuple[Embedding, float]]:
        """
        Find similar vectors using Pinecone with filtering and ranking.

        Args:
            query_vector: Query vector for similarity search
            top_k: Number of results to return
            filters: Optional metadata filters

        Returns:
            List of tuples containing similar embeddings and scores
        """
        try:
            # Validate query vector
            if not isinstance(query_vector, np.ndarray):
                raise TypeError("Query vector must be numpy array")
                
            if query_vector.shape[0] > MAX_VECTOR_DIMENSION:
                raise ValueError(f"Vector dimension exceeds maximum: {MAX_VECTOR_DIMENSION}")
            
            # Normalize query vector
            query_vector = query_vector / np.linalg.norm(query_vector)
            
            # Perform similarity search
            similar_embeddings = await self._pinecone_client.find_similar(
                vector=query_vector,
                top_k=top_k,
                score_threshold=self._threshold,
                filter_params=filters
            )
            
            # Process and sort results
            results = []
            for embedding in similar_embeddings:
                score = self.calculate_similarity(query_vector, embedding.vector)
                if score >= self._threshold:
                    results.append((embedding, score))
            
            # Sort by similarity score
            results.sort(key=lambda x: x[1], reverse=True)
            
            logger.info(
                "Completed similar vectors search",
                extra={
                    "results_count": len(results),
                    "top_score": results[0][1] if results else 0
                }
            )
            
            return results[:top_k]
            
        except Exception as e:
            logger.error(
                f"Similar vectors search failed: {str(e)}",
                extra={"error_type": type(e).__name__}
            )
            raise

    def batch_similarity(
        self,
        vector_pairs: List[Tuple[np.ndarray, np.ndarray]],
        batch_size: int = MAX_BATCH_SIZE
    ) -> np.ndarray:
        """
        Process batch similarity calculations in parallel.

        Args:
            vector_pairs: List of vector pairs to compare
            batch_size: Size of processing batches

        Returns:
            Array of similarity scores
        """
        try:
            if not vector_pairs:
                return np.array([])
                
            if batch_size > MAX_BATCH_SIZE:
                batch_size = MAX_BATCH_SIZE
            
            # Split into batches
            batches = [
                vector_pairs[i:i + batch_size]
                for i in range(0, len(vector_pairs), batch_size)
            ]
            
            # Process batches in parallel
            scores = []
            with ThreadPoolExecutor(max_workers=len(batches)) as executor:
                futures = []
                for batch in batches:
                    future = executor.submit(self._process_batch, batch)
                    futures.append(future)
                
                # Collect results
                for future in futures:
                    batch_scores = future.result()
                    scores.extend(batch_scores)
            
            logger.info(
                "Completed batch similarity processing",
                extra={
                    "total_pairs": len(vector_pairs),
                    "batch_count": len(batches)
                }
            )
            
            return np.array(scores)
            
        except Exception as e:
            logger.error(
                f"Batch similarity processing failed: {str(e)}",
                extra={"error_type": type(e).__name__}
            )
            raise

    def _process_batch(
        self,
        batch: List[Tuple[np.ndarray, np.ndarray]]
    ) -> List[float]:
        """Process a single batch of vector pairs."""
        return [
            self.calculate_similarity(vec1, vec2)
            for vec1, vec2 in batch
        ]