"""
Enterprise-grade relationship extractor for knowledge graph construction.
Implements intelligent relationship detection with enhanced error handling, caching, and monitoring.

Version: 1.0.0
"""

import numpy as np  # numpy v1.24.0
import logging
import asyncio
from typing import List, Dict, Optional, Tuple
from prometheus_client import Counter  # prometheus_client v0.17.0
import threading
from datetime import datetime, timezone

from ...models.relationship import (
    Relationship,
    RELATIONSHIP_TYPES,
)
from ....vector-service.app.core.similarity_calculator import SimilarityCalculator

# Constants for relationship extraction configuration
SIMILARITY_THRESHOLD = 0.7
MAX_RELATIONSHIPS_PER_NODE = 20
RELATIONSHIP_WEIGHTS = {
    "IS_PREREQUISITE": 1.0,
    "IS_RELATED": 0.7,
    "CONTAINS": 0.9,
    "REFERENCES": 0.6,
    "EXTENDS": 0.8
}
BATCH_SIZE = 100
CACHE_TTL = 3600  # 1 hour

# Initialize logging
logger = logging.getLogger(__name__)

# Prometheus metrics
METRICS = Counter('relationship_extractions_total', 'Total number of relationship extractions')

class RelationshipExtractor:
    """
    Enterprise-grade relationship extractor with caching, monitoring, and batch processing.
    Implements comprehensive relationship detection algorithms with quality scoring.
    """

    def __init__(self, similarity_calculator: Optional[SimilarityCalculator] = None):
        """
        Initialize relationship extractor with enhanced components.

        Args:
            similarity_calculator: Optional pre-configured similarity calculator
        """
        self._similarity_calculator = similarity_calculator or SimilarityCalculator()
        self._relationship_cache = {}
        self._cache_lock = threading.Lock()
        self._metrics = METRICS

        logger.info(
            "Initialized RelationshipExtractor",
            extra={"similarity_threshold": SIMILARITY_THRESHOLD}
        )

    async def extract_relationships(
        self,
        nodes: List[dict],
        batch_size: Optional[int] = BATCH_SIZE
    ) -> List[Relationship]:
        """
        Extract relationships between nodes with enhanced error handling and batch processing.

        Args:
            nodes: List of knowledge nodes
            batch_size: Optional batch size for processing

        Returns:
            List of validated relationships
        """
        try:
            if not nodes:
                return []

            # Validate batch size
            batch_size = min(batch_size or BATCH_SIZE, len(nodes))
            
            # Process nodes in batches
            relationships = []
            batches = [nodes[i:i + batch_size] for i in range(0, len(nodes), batch_size)]
            
            for batch in batches:
                # Generate node pairs for comparison
                node_pairs = [
                    (source, target) 
                    for i, source in enumerate(batch)
                    for target in batch[i + 1:]
                ]
                
                # Calculate similarities in parallel
                similarity_tasks = []
                for source, target in node_pairs:
                    cache_key = (source['id'], target['id'])
                    
                    # Check cache first
                    cached_relationship = self._get_cached_relationship(cache_key)
                    if cached_relationship:
                        relationships.append(cached_relationship)
                        continue
                    
                    # Calculate similarity if not cached
                    task = asyncio.create_task(
                        self._similarity_calculator.calculate_similarity(
                            np.array(source['vector']),
                            np.array(target['vector'])
                        )
                    )
                    similarity_tasks.append((task, source, target))
                
                # Process similarity results
                for task, source, target in similarity_tasks:
                    similarity_score = await task
                    
                    if similarity_score >= SIMILARITY_THRESHOLD:
                        relationship_type = self.determine_relationship_type(
                            source, target, similarity_score
                        )
                        
                        if relationship_type:
                            weight = self.calculate_relationship_weight(
                                relationship_type,
                                similarity_score,
                                {"source_quality": source.get("quality_score", 0.5),
                                 "target_quality": target.get("quality_score", 0.5)}
                            )
                            
                            relationship = Relationship(
                                type=relationship_type,
                                source_id=source['id'],
                                target_id=target['id'],
                                weight=weight,
                                metadata={
                                    "similarity_score": similarity_score,
                                    "extraction_timestamp": datetime.now(timezone.utc).isoformat(),
                                    "source_type": source.get("type"),
                                    "target_type": target.get("type")
                                }
                            )
                            
                            # Cache the relationship
                            self._cache_relationship(
                                (source['id'], target['id']),
                                relationship
                            )
                            
                            relationships.append(relationship)

            # Filter and validate final relationship set
            filtered_relationships = self.filter_relationships(relationships)
            
            # Update metrics
            self._metrics.inc(len(filtered_relationships))
            
            logger.info(
                "Relationship extraction completed",
                extra={
                    "total_nodes": len(nodes),
                    "relationships_found": len(filtered_relationships)
                }
            )
            
            return filtered_relationships

        except Exception as e:
            logger.error(
                f"Relationship extraction failed: {str(e)}",
                extra={"error_type": type(e).__name__}
            )
            raise

    def determine_relationship_type(
        self,
        source_node: dict,
        target_node: dict,
        similarity_score: float
    ) -> str:
        """
        Determine relationship type using semantic rules and content analysis.

        Args:
            source_node: Source knowledge node
            target_node: Target knowledge node
            similarity_score: Calculated similarity score

        Returns:
            Determined relationship type
        """
        try:
            # Check for prerequisite relationship
            if (source_node.get("level", 0) < target_node.get("level", 0) and
                similarity_score > 0.8):
                return "IS_PREREQUISITE"
            
            # Check for containment
            if (source_node.get("scope", "") in target_node.get("scope", "") and
                similarity_score > 0.85):
                return "CONTAINS"
            
            # Check for extension relationship
            if (source_node.get("type") == target_node.get("type") and
                similarity_score > 0.9):
                return "EXTENDS"
            
            # Check for reference relationship
            if any(ref in target_node.get("references", [])
                  for ref in source_node.get("references", [])):
                return "REFERENCES"
            
            # Default to related for high similarity
            if similarity_score >= SIMILARITY_THRESHOLD:
                return "IS_RELATED"
            
            return None

        except Exception as e:
            logger.error(
                f"Relationship type determination failed: {str(e)}",
                extra={
                    "source_id": source_node.get("id"),
                    "target_id": target_node.get("id")
                }
            )
            raise

    def calculate_relationship_weight(
        self,
        relationship_type: str,
        similarity_score: float,
        quality_factors: Optional[dict] = None
    ) -> float:
        """
        Calculate relationship weight with quality factors and normalization.

        Args:
            relationship_type: Type of relationship
            similarity_score: Calculated similarity score
            quality_factors: Optional quality metrics

        Returns:
            Normalized relationship weight
        """
        try:
            # Get base weight for relationship type
            base_weight = RELATIONSHIP_WEIGHTS.get(relationship_type, 0.5)
            
            # Apply similarity score modifier
            weight = base_weight * similarity_score
            
            # Apply quality factors if provided
            if quality_factors:
                source_quality = quality_factors.get("source_quality", 0.5)
                target_quality = quality_factors.get("target_quality", 0.5)
                quality_modifier = (source_quality + target_quality) / 2
                weight *= quality_modifier
            
            # Normalize weight to [0,1] range
            weight = max(0.0, min(1.0, weight))
            
            return weight

        except Exception as e:
            logger.error(
                f"Weight calculation failed: {str(e)}",
                extra={"relationship_type": relationship_type}
            )
            raise

    def filter_relationships(
        self,
        relationships: List[Relationship],
        filter_params: Optional[dict] = None
    ) -> List[Relationship]:
        """
        Filter relationships based on quality criteria and constraints.

        Args:
            relationships: List of relationships to filter
            filter_params: Optional filtering parameters

        Returns:
            Filtered list of relationships
        """
        try:
            if not relationships:
                return []
            
            # Sort by weight descending
            sorted_relationships = sorted(
                relationships,
                key=lambda r: r.weight,
                reverse=True
            )
            
            # Apply similarity threshold
            filtered = [
                r for r in sorted_relationships
                if r.metadata.get("similarity_score", 0) >= SIMILARITY_THRESHOLD
            ]
            
            # Enforce per-node relationship limit
            node_relationships = {}
            final_relationships = []
            
            for rel in filtered:
                source_count = node_relationships.get(rel.source_id, 0)
                target_count = node_relationships.get(rel.target_id, 0)
                
                if (source_count < MAX_RELATIONSHIPS_PER_NODE and
                    target_count < MAX_RELATIONSHIPS_PER_NODE):
                    final_relationships.append(rel)
                    node_relationships[rel.source_id] = source_count + 1
                    node_relationships[rel.target_id] = target_count + 1
            
            return final_relationships

        except Exception as e:
            logger.error(
                f"Relationship filtering failed: {str(e)}",
                extra={"relationships_count": len(relationships)}
            )
            raise

    def _get_cached_relationship(self, cache_key: Tuple[str, str]) -> Optional[Relationship]:
        """Get relationship from cache if available and valid."""
        with self._cache_lock:
            cached = self._relationship_cache.get(cache_key)
            if cached:
                timestamp, relationship = cached
                if (datetime.now(timezone.utc) - timestamp).total_seconds() < CACHE_TTL:
                    return relationship
        return None

    def _cache_relationship(self, cache_key: Tuple[str, str], relationship: Relationship) -> None:
        """Cache relationship with timestamp."""
        with self._cache_lock:
            self._relationship_cache[cache_key] = (datetime.now(timezone.utc), relationship)