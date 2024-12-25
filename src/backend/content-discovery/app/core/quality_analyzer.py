# External imports with versions specified for security and compatibility
import numpy as np  # ^1.24.0
from typing import Dict, Optional, List, Tuple
from dataclasses import dataclass, field
import asyncio
from datetime import datetime

# Internal imports
from ..models.content import Content
from ..utils.logger import logger

# Constants for quality analysis
QUALITY_WEIGHTS = {
    'relevance': 0.35,
    'engagement': 0.25,
    'credibility': 0.20,
    'freshness': 0.10,
    'completeness': 0.10
}

CONTENT_TYPE_WEIGHTS = {
    'video': {'engagement': 0.30, 'freshness': 0.15},
    'podcast': {'engagement': 0.30, 'freshness': 0.15},
    'article': {'credibility': 0.25, 'completeness': 0.15},
    'book': {'credibility': 0.30, 'completeness': 0.20}
}

@dataclass
class QualityMetrics:
    """Data class containing comprehensive quality metrics with validation."""
    relevance_score: float = field(default=0.0)
    engagement_score: float = field(default=0.0)
    credibility_score: float = field(default=0.0)
    freshness_score: float = field(default=0.0)
    completeness_score: float = field(default=0.0)
    
    def __post_init__(self):
        """Validates all scores are within valid range."""
        for field_name, value in self.__dict__.items():
            if not 0.0 <= value <= 1.0:
                raise ValueError(f"{field_name} must be between 0.0 and 1.0")

class QualityAnalyzer:
    """
    Analyzes content quality using multiple weighted metrics with enhanced async processing
    and performance optimizations.
    """
    
    def __init__(
        self,
        quality_threshold: Optional[float] = 0.9,
        metric_weights: Optional[Dict[str, float]] = None
    ):
        """
        Initializes the quality analyzer with configurable weights and thresholds.

        Args:
            quality_threshold: Minimum quality score threshold (default: 0.9)
            metric_weights: Custom weights for different quality metrics
        """
        self._quality_threshold = quality_threshold
        self._metric_weights = metric_weights or QUALITY_WEIGHTS.copy()
        
        # Validate weights sum to 1.0
        if abs(sum(self._metric_weights.values()) - 1.0) > 0.001:
            raise ValueError("Metric weights must sum to 1.0")
            
        # Initialize performance monitoring
        self._processing_times: List[float] = []
        self._last_optimization = datetime.utcnow()

    async def analyze_content(self, content: Content, topic: str) -> float:
        """
        Analyzes content quality asynchronously using multiple metrics.

        Args:
            content: Content instance to analyze
            topic: Topic for relevance calculation

        Returns:
            float: Computed quality score between 0 and 1

        Raises:
            ValueError: If content validation fails
        """
        start_time = datetime.utcnow()
        
        try:
            logger.debug(
                "Starting content quality analysis",
                extra={
                    "content_id": str(content.id),
                    "content_type": content.type,
                    "topic": topic
                }
            )

            # Initialize quality metrics
            metrics = QualityMetrics()
            
            # Concurrent metric calculation
            tasks = [
                self._calculate_relevance(content, topic),
                self._calculate_engagement(content),
                self._calculate_credibility(content),
                self._calculate_freshness(content),
                self._calculate_completeness(content)
            ]
            
            results = await asyncio.gather(*tasks)
            
            # Assign results to metrics
            metrics.relevance_score = results[0]
            metrics.engagement_score = results[1]
            metrics.credibility_score = results[2]
            metrics.freshness_score = results[3]
            metrics.completeness_score = results[4]

            # Apply content type-specific weight adjustments
            adjusted_weights = self._adjust_weights_for_content_type(
                content.type,
                self._metric_weights.copy()
            )

            # Calculate final score with adjusted weights
            final_score = (
                metrics.relevance_score * adjusted_weights['relevance'] +
                metrics.engagement_score * adjusted_weights['engagement'] +
                metrics.credibility_score * adjusted_weights['credibility'] +
                metrics.freshness_score * adjusted_weights['freshness'] +
                metrics.completeness_score * adjusted_weights['completeness']
            )

            # Update content quality score
            await content.update_quality_score(final_score)

            # Log analysis results
            logger.info(
                "Content quality analysis completed",
                extra={
                    "content_id": str(content.id),
                    "quality_score": final_score,
                    "metrics": {
                        "relevance": metrics.relevance_score,
                        "engagement": metrics.engagement_score,
                        "credibility": metrics.credibility_score,
                        "freshness": metrics.freshness_score,
                        "completeness": metrics.completeness_score
                    }
                }
            )

            # Update performance metrics
            self._update_performance_metrics(start_time)

            return final_score

        except Exception as e:
            logger.error(
                "Content quality analysis failed",
                extra={
                    "content_id": str(content.id),
                    "error": str(e)
                }
            )
            raise

    async def _calculate_relevance(self, content: Content, topic: str) -> float:
        """Calculates content relevance score using semantic analysis."""
        # Implement semantic similarity calculation here
        # Placeholder implementation
        return 0.9

    async def _calculate_engagement(self, content: Content) -> float:
        """Calculates engagement score based on content type-specific metrics."""
        if content.type == "video":
            return self._calculate_video_engagement(content)
        elif content.type == "podcast":
            return self._calculate_podcast_engagement(content)
        elif content.type == "article":
            return self._calculate_article_engagement(content)
        elif content.type == "book":
            return self._calculate_book_engagement(content)
        return 0.0

    async def _calculate_credibility(self, content: Content) -> float:
        """Calculates credibility score based on source and metadata."""
        try:
            source_score = 0.8  # Placeholder for source credibility check
            metadata_score = self._validate_metadata_quality(content)
            return np.mean([source_score, metadata_score])
        except Exception as e:
            logger.error(f"Credibility calculation error: {str(e)}")
            return 0.0

    async def _calculate_freshness(self, content: Content) -> float:
        """Calculates content freshness score based on publication date."""
        try:
            if 'publication_date' in content.metadata:
                pub_date = datetime.fromisoformat(content.metadata['publication_date'])
                age_days = (datetime.utcnow() - pub_date).days
                return max(0.0, min(1.0, 1.0 - (age_days / 365)))
            return 0.5
        except Exception as e:
            logger.error(f"Freshness calculation error: {str(e)}")
            return 0.0

    async def _calculate_completeness(self, content: Content) -> float:
        """Calculates completeness score based on metadata requirements."""
        try:
            required_fields = set(content.metadata.keys())
            actual_fields = set(content.metadata.keys())
            completeness = len(actual_fields.intersection(required_fields)) / len(required_fields)
            return completeness
        except Exception as e:
            logger.error(f"Completeness calculation error: {str(e)}")
            return 0.0

    def _adjust_weights_for_content_type(
        self,
        content_type: str,
        base_weights: Dict[str, float]
    ) -> Dict[str, float]:
        """Adjusts metric weights based on content type."""
        if content_type in CONTENT_TYPE_WEIGHTS:
            adjustments = CONTENT_TYPE_WEIGHTS[content_type]
            for metric, adjustment in adjustments.items():
                base_weights[metric] = adjustment
                
            # Normalize weights to sum to 1.0
            total = sum(base_weights.values())
            return {k: v/total for k, v in base_weights.items()}
        
        return base_weights

    def _validate_metadata_quality(self, content: Content) -> float:
        """Validates metadata quality and completeness."""
        try:
            required_fields = content.metadata.keys()
            valid_fields = sum(1 for field in required_fields if content.metadata.get(field))
            return valid_fields / len(required_fields)
        except Exception:
            return 0.0

    def _update_performance_metrics(self, start_time: datetime) -> None:
        """Updates performance metrics for optimization."""
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        self._processing_times.append(processing_time)
        
        # Keep only last 1000 measurements
        if len(self._processing_times) > 1000:
            self._processing_times = self._processing_times[-1000:]

    def _calculate_video_engagement(self, content: Content) -> float:
        """Calculates video-specific engagement score."""
        try:
            views = content.metadata.get('views', 0)
            likes = content.metadata.get('likes', 0)
            comments = content.metadata.get('comments', 0)
            
            view_score = min(1.0, views / 10000)
            interaction_score = min(1.0, (likes + comments) / 1000)
            
            return np.mean([view_score, interaction_score])
        except Exception:
            return 0.0

    def _calculate_podcast_engagement(self, content: Content) -> float:
        """Calculates podcast-specific engagement score."""
        try:
            listens = content.metadata.get('listens', 0)
            subscribers = content.metadata.get('subscribers', 0)
            
            listen_score = min(1.0, listens / 5000)
            subscriber_score = min(1.0, subscribers / 1000)
            
            return np.mean([listen_score, subscriber_score])
        except Exception:
            return 0.0

    def _calculate_article_engagement(self, content: Content) -> float:
        """Calculates article-specific engagement score."""
        try:
            reads = content.metadata.get('reads', 0)
            shares = content.metadata.get('shares', 0)
            
            read_score = min(1.0, reads / 1000)
            share_score = min(1.0, shares / 100)
            
            return np.mean([read_score, share_score])
        except Exception:
            return 0.0

    def _calculate_book_engagement(self, content: Content) -> float:
        """Calculates book-specific engagement score."""
        try:
            ratings = content.metadata.get('ratings', 0)
            reviews = content.metadata.get('reviews', 0)
            
            rating_score = min(1.0, ratings / 1000)
            review_score = min(1.0, reviews / 100)
            
            return np.mean([rating_score, review_score])
        except Exception:
            return 0.0