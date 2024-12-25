# External imports with versions specified for security and compatibility
import asyncio
from typing import Dict, List, Optional
from uuid import UUID
from opentelemetry import trace
from circuit_breaker import circuit_breaker
from cachetools import TTLCache
import logging

# Internal imports
from ..services.youtube_service import YouTubeService
from ..services.spotify_service import SpotifyService
from ..services.books_service import GoogleBooksService
from ..models.content import Content
from ..utils.logger import get_logger

# Initialize logger
logger = get_logger(__name__)

# Constants
CACHE_TTL = 3600  # 1 hour cache TTL
CACHE_MAX_SIZE = 1000
REQUEST_TIMEOUT = 30  # seconds
MAX_PARALLEL_REQUESTS = 3

class SourceAggregator:
    """
    Enterprise-grade content discovery orchestrator that aggregates and processes
    content from multiple sources with enhanced reliability, caching, and monitoring.
    """

    def __init__(self, config: Dict):
        """
        Initializes source services and supporting components.

        Args:
            config: Configuration dictionary for service settings
        """
        # Initialize services
        self._youtube_service = YouTubeService()
        self._spotify_service = SpotifyService()
        self._books_service = GoogleBooksService()
        
        # Store configuration
        self._config = config
        
        # Initialize cache with TTL
        self._cache = TTLCache(
            maxsize=CACHE_MAX_SIZE,
            ttl=CACHE_TTL
        )
        
        # Initialize tracer
        self._tracer = trace.get_tracer(__name__)
        
        # Initialize logger
        self._logger = logger

    @trace.start_as_current_span("discover_content")
    async def discover_content(
        self,
        topic_id: UUID,
        query: str,
        filters: Optional[Dict] = None
    ) -> List[Content]:
        """
        Discovers content from all sources for a given topic with enhanced error handling,
        caching, and parallel processing.

        Args:
            topic_id: UUID of the topic being researched
            query: Search query string
            filters: Optional filters for content discovery

        Returns:
            List[Content]: Aggregated and deduplicated content from all sources

        Raises:
            ValueError: If input parameters are invalid
            RuntimeError: If content discovery fails across all sources
        """
        # Input validation
        if not query or not query.strip():
            raise ValueError("Search query cannot be empty")

        # Check cache
        cache_key = f"{topic_id}:{query}:{filters}"
        if cache_key in self._cache:
            self._logger.info(
                "Returning cached results",
                extra={
                    "topic_id": str(topic_id),
                    "query": query
                }
            )
            return self._cache[cache_key]

        try:
            # Create tasks for parallel content discovery
            tasks = [
                self._discover_videos(topic_id, query),
                self._discover_podcasts(topic_id, query),
                self._discover_books(topic_id, query)
            ]

            # Execute tasks with timeout
            results = await asyncio.gather(
                *tasks,
                return_exceptions=True
            )

            # Process results and handle errors
            all_content = []
            for source, result in zip(['videos', 'podcasts', 'books'], results):
                if isinstance(result, Exception):
                    self._logger.error(
                        f"Content discovery failed for {source}",
                        extra={
                            "topic_id": str(topic_id),
                            "error": str(result)
                        }
                    )
                else:
                    all_content.extend(result)

            # Apply filters if provided
            if filters:
                all_content = self._apply_filters(all_content, filters)

            # Sort by quality score
            all_content.sort(key=lambda x: x.quality_score, reverse=True)

            # Cache results
            self._cache[cache_key] = all_content

            self._logger.info(
                "Content discovery completed",
                extra={
                    "topic_id": str(topic_id),
                    "total_items": len(all_content),
                    "sources": {
                        "videos": sum(1 for c in all_content if c.type == "video"),
                        "podcasts": sum(1 for c in all_content if c.type == "podcast"),
                        "books": sum(1 for c in all_content if c.type == "book")
                    }
                }
            )

            return all_content

        except Exception as e:
            self._logger.error(
                "Content discovery failed",
                extra={
                    "topic_id": str(topic_id),
                    "query": query,
                    "error": str(e)
                }
            )
            raise RuntimeError(f"Content discovery failed: {str(e)}")

    @circuit_breaker(failure_threshold=3, recovery_timeout=30)
    async def _discover_videos(self, topic_id: UUID, query: str) -> List[Content]:
        """
        Discovers video content with circuit breaker protection.

        Args:
            topic_id: Topic UUID
            query: Search query

        Returns:
            List[Content]: Discovered video content
        """
        with self._tracer.start_as_current_span("discover_videos") as span:
            span.set_attribute("topic_id", str(topic_id))
            span.set_attribute("query", query)

            try:
                return await self._youtube_service.search_videos(
                    topic_id=topic_id,
                    query=query,
                    max_results=self._config.get("max_videos", 20)
                )
            except Exception as e:
                self._logger.error(
                    "Video discovery failed",
                    extra={
                        "topic_id": str(topic_id),
                        "error": str(e)
                    }
                )
                raise

    @circuit_breaker(failure_threshold=3, recovery_timeout=30)
    async def _discover_podcasts(self, topic_id: UUID, query: str) -> List[Content]:
        """
        Discovers podcast content with circuit breaker protection.

        Args:
            topic_id: Topic UUID
            query: Search query

        Returns:
            List[Content]: Discovered podcast content
        """
        with self._tracer.start_as_current_span("discover_podcasts") as span:
            span.set_attribute("topic_id", str(topic_id))
            span.set_attribute("query", query)

            try:
                return await self._spotify_service.search_podcasts(
                    query=query,
                    limit=self._config.get("max_podcasts", 20)
                )
            except Exception as e:
                self._logger.error(
                    "Podcast discovery failed",
                    extra={
                        "topic_id": str(topic_id),
                        "error": str(e)
                    }
                )
                raise

    @circuit_breaker(failure_threshold=3, recovery_timeout=30)
    async def _discover_books(self, topic_id: UUID, query: str) -> List[Content]:
        """
        Discovers book content with circuit breaker protection.

        Args:
            topic_id: Topic UUID
            query: Search query

        Returns:
            List[Content]: Discovered book content
        """
        with self._tracer.start_as_current_span("discover_books") as span:
            span.set_attribute("topic_id", str(topic_id))
            span.set_attribute("query", query)

            try:
                return await self._books_service.search_books(
                    topic=query,
                    topic_id=topic_id,
                    filters=self._config.get("book_filters")
                )
            except Exception as e:
                self._logger.error(
                    "Book discovery failed",
                    extra={
                        "topic_id": str(topic_id),
                        "error": str(e)
                    }
                )
                raise

    def _apply_filters(self, content_list: List[Content], filters: Dict) -> List[Content]:
        """
        Applies custom filters to content list.

        Args:
            content_list: List of content items
            filters: Filter criteria

        Returns:
            List[Content]: Filtered content list
        """
        filtered_content = content_list

        if "min_quality_score" in filters:
            filtered_content = [
                c for c in filtered_content
                if c.quality_score >= filters["min_quality_score"]
            ]

        if "content_types" in filters:
            filtered_content = [
                c for c in filtered_content
                if c.type in filters["content_types"]
            ]

        if "max_results" in filters:
            filtered_content = filtered_content[:filters["max_results"]]

        return filtered_content