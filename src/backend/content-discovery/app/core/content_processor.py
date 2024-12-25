# External imports with versions specified for security and compatibility
import asyncio  # built-in
from typing import List, Dict, Optional, UUID  # built-in
from dataclasses import dataclass  # built-in
import logging
from datetime import datetime
from prometheus_client import Counter, Histogram

# Internal imports
from ..models.content import Content
from .quality_analyzer import QualityAnalyzer
from .source_aggregator import SourceAggregator
from ..utils.logger import get_logger

# Initialize logger
logger = get_logger(__name__)

# Metrics collectors
PROCESSING_TIME = Histogram(
    'content_processing_duration_seconds',
    'Time spent processing content items',
    ['content_type']
)

PROCESSED_ITEMS = Counter(
    'content_items_processed_total',
    'Total number of content items processed',
    ['content_type', 'status']
)

@dataclass
class ProcessingMetrics:
    """Data class for tracking content processing metrics."""
    start_time: datetime
    total_items: int = 0
    processed_items: int = 0
    failed_items: int = 0
    quality_filtered: int = 0

class ContentProcessor:
    """
    Enterprise-grade content processor implementing parallel processing, quality assessment,
    and comprehensive error handling for content discovery and enrichment.
    """

    def __init__(
        self,
        quality_threshold: Optional[float] = 0.9,
        max_parallel_tasks: Optional[int] = 10,
        retry_attempts: Optional[int] = 3,
        retry_delay: Optional[float] = 1.0
    ):
        """
        Initializes content processor with configurable parameters.

        Args:
            quality_threshold: Minimum quality score threshold (default: 0.9)
            max_parallel_tasks: Maximum parallel processing tasks (default: 10)
            retry_attempts: Number of retry attempts for failed operations (default: 3)
            retry_delay: Delay between retries in seconds (default: 1.0)
        """
        self._quality_analyzer = QualityAnalyzer(quality_threshold=quality_threshold)
        self._source_aggregator = SourceAggregator({
            "max_videos": 20,
            "max_podcasts": 20,
            "max_books": 20
        })
        
        self._quality_threshold = quality_threshold
        self._max_parallel_tasks = max_parallel_tasks
        self._retry_attempts = retry_attempts
        self._retry_delay = retry_delay
        
        # Initialize processing semaphore for parallel task control
        self._semaphore = asyncio.Semaphore(max_parallel_tasks)

    async def process_topic(
        self,
        topic_id: UUID,
        query: str,
        filters: Optional[Dict] = None
    ) -> List[Content]:
        """
        Discovers and processes content for a given topic with parallel execution.

        Args:
            topic_id: UUID of the topic
            query: Search query string
            filters: Optional content filters

        Returns:
            List[Content]: Processed and filtered content items

        Raises:
            ValueError: If input parameters are invalid
            RuntimeError: If processing fails critically
        """
        metrics = ProcessingMetrics(start_time=datetime.utcnow())
        
        try:
            logger.info(
                "Starting content processing",
                extra={
                    "topic_id": str(topic_id),
                    "query": query
                }
            )

            # Validate input parameters
            if not query or not query.strip():
                raise ValueError("Search query cannot be empty")

            # Discover content from all sources
            raw_content = await self._source_aggregator.discover_content(
                topic_id=topic_id,
                query=query,
                filters=filters
            )
            
            metrics.total_items = len(raw_content)
            
            # Process content items in parallel with controlled concurrency
            processing_tasks = []
            for content in raw_content:
                task = asyncio.create_task(
                    self._process_content_item(content, query)
                )
                processing_tasks.append(task)

            # Wait for all processing tasks to complete
            processed_items = await asyncio.gather(
                *processing_tasks,
                return_exceptions=True
            )

            # Filter out failed items and apply quality threshold
            valid_items = []
            for item in processed_items:
                if isinstance(item, Exception):
                    metrics.failed_items += 1
                    continue
                    
                if item.quality_score >= self._quality_threshold:
                    valid_items.append(item)
                    metrics.processed_items += 1
                else:
                    metrics.quality_filtered += 1

            # Sort by quality score
            valid_items.sort(key=lambda x: x.quality_score, reverse=True)

            # Log processing metrics
            processing_time = (datetime.utcnow() - metrics.start_time).total_seconds()
            logger.info(
                "Content processing completed",
                extra={
                    "topic_id": str(topic_id),
                    "total_items": metrics.total_items,
                    "processed_items": metrics.processed_items,
                    "failed_items": metrics.failed_items,
                    "quality_filtered": metrics.quality_filtered,
                    "processing_time": processing_time
                }
            )

            return valid_items

        except Exception as e:
            logger.error(
                "Content processing failed",
                extra={
                    "topic_id": str(topic_id),
                    "error": str(e)
                }
            )
            raise RuntimeError(f"Content processing failed: {str(e)}")

    async def _process_content_item(self, content: Content, topic: str) -> Content:
        """
        Processes a single content item with retries and error handling.

        Args:
            content: Content item to process
            topic: Topic for relevance calculation

        Returns:
            Content: Processed content item with quality score

        Raises:
            ValueError: If content validation fails
            Exception: If processing fails after retries
        """
        start_time = datetime.utcnow()

        async with self._semaphore:
            try:
                # Validate content
                if not self._validate_content(content):
                    raise ValueError(f"Invalid content: {content.id}")

                # Apply retry policy for external operations
                for attempt in range(self._retry_attempts):
                    try:
                        # Analyze content quality
                        quality_score = await self._quality_analyzer.analyze_content(
                            content=content,
                            topic=topic
                        )
                        
                        # Update content quality score
                        await content.update_quality_score(quality_score)
                        
                        # Enrich content metadata
                        content.metadata.update(
                            await self._enrich_metadata(content)
                        )
                        
                        # Save processed content
                        await content.save()

                        # Record metrics
                        processing_time = (datetime.utcnow() - start_time).total_seconds()
                        PROCESSING_TIME.labels(
                            content_type=content.type
                        ).observe(processing_time)
                        
                        PROCESSED_ITEMS.labels(
                            content_type=content.type,
                            status="success"
                        ).inc()

                        return content

                    except Exception as e:
                        if attempt == self._retry_attempts - 1:
                            raise
                        await asyncio.sleep(self._retry_delay * (2 ** attempt))

            except Exception as e:
                logger.error(
                    "Content item processing failed",
                    extra={
                        "content_id": str(content.id),
                        "error": str(e)
                    }
                )
                PROCESSED_ITEMS.labels(
                    content_type=content.type,
                    status="failed"
                ).inc()
                raise

    def _validate_content(self, content: Content) -> bool:
        """
        Validates required content attributes with enhanced checks.

        Args:
            content: Content item to validate

        Returns:
            bool: Validation result
        """
        try:
            # Check required fields
            required_fields = ["title", "description", "source_url", "type"]
            for field in required_fields:
                if not getattr(content, field, None):
                    logger.warning(
                        f"Missing required field: {field}",
                        extra={"content_id": str(content.id)}
                    )
                    return False

            # Validate content type
            if content.type not in ["video", "podcast", "article", "book"]:
                logger.warning(
                    "Invalid content type",
                    extra={
                        "content_id": str(content.id),
                        "type": content.type
                    }
                )
                return False

            # Validate metadata
            if not content.validate_metadata():
                logger.warning(
                    "Invalid metadata",
                    extra={"content_id": str(content.id)}
                )
                return False

            return True

        except Exception as e:
            logger.error(
                "Content validation failed",
                extra={
                    "content_id": str(content.id),
                    "error": str(e)
                }
            )
            return False

    async def _enrich_metadata(self, content: Content) -> Dict:
        """
        Enriches content metadata with comprehensive information.

        Args:
            content: Content item to enrich

        Returns:
            Dict: Enriched metadata
        """
        enriched_metadata = {}
        
        try:
            # Add processing timestamps
            enriched_metadata.update({
                "processed_at": datetime.utcnow().isoformat(),
                "last_updated": datetime.utcnow().isoformat()
            })

            # Add source information
            enriched_metadata.update({
                "source_domain": content.source_url.split("/")[2],
                "content_type": content.type
            })

            # Add quality metrics
            enriched_metadata.update({
                "quality_score": content.quality_score,
                "quality_threshold": self._quality_threshold
            })

            # Add processing history
            enriched_metadata["processing_history"] = {
                "version": "1.0.0",
                "processor": "ContentProcessor",
                "timestamp": datetime.utcnow().isoformat()
            }

            return enriched_metadata

        except Exception as e:
            logger.error(
                "Metadata enrichment failed",
                extra={
                    "content_id": str(content.id),
                    "error": str(e)
                }
            )
            return {}