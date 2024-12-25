"""
Integration tests for content aggregation functionality, verifying multi-source content
discovery, quality assessment, and system resilience.

Version: 1.0.0
"""

import pytest
import asyncio
import time
from typing import Dict, Any
from uuid import uuid4
from unittest.mock import AsyncMock

from ../../utils.python.test_helpers import TestBase
from ../../utils.python.mock_factory import MockFactory
from content_discovery.app.core.source_aggregator import SourceAggregator

@pytest.mark.asyncio
@pytest.mark.integration
class TestContentAggregation(TestBase):
    """
    Comprehensive integration test suite for content aggregation functionality,
    validating multi-source discovery, quality assessment, and system resilience.
    """

    def __init__(self):
        """Initialize test suite with required configurations and mocks."""
        super().__init__()
        self._mock_factory = MockFactory()
        self._aggregator = None
        self._test_data = {}
        self._performance_threshold = 5.0  # 5 seconds per content item
        self._quality_threshold = 0.9  # 90% quality threshold
        self._source_configs = {
            "max_videos": 20,
            "max_podcasts": 20,
            "max_books": 20,
            "book_filters": {"langRestrict": "en"}
        }

    def setup_method(self, method):
        """Set up test environment before each test."""
        super().setup_method(method)

        # Create fresh service mocks
        youtube_mock = self._mock_factory.create_youtube_service_mock()
        spotify_mock = self._mock_factory.create_spotify_service_mock()
        books_mock = self._mock_factory.create_google_books_service_mock()

        # Initialize aggregator with mocks
        self._aggregator = SourceAggregator(config=self._source_configs)
        self._aggregator._youtube_service = youtube_mock
        self._aggregator._spotify_service = spotify_mock
        self._aggregator._books_service = books_mock

        # Load test data
        self._test_data = {
            "topic_id": uuid4(),
            "query": "machine learning",
            "filters": {
                "min_quality_score": 0.9,
                "content_types": ["video", "podcast", "book"],
                "max_results": 50
            }
        }

    async def test_content_discovery_all_sources(self):
        """
        Tests comprehensive content discovery from all configured sources with
        quality and performance validation.
        """
        # Arrange
        topic_id = self._test_data["topic_id"]
        query = self._test_data["query"]
        filters = self._test_data["filters"]

        # Act
        start_time = time.time()
        content_results = await self._aggregator.discover_content(
            topic_id=topic_id,
            query=query,
            filters=filters
        )
        execution_time = time.time() - start_time

        # Assert - Content Quality
        for content in content_results:
            assert content.quality_score >= self._quality_threshold, (
                f"Content quality below threshold: {content.quality_score}"
            )

        # Assert - Performance
        assert execution_time <= self._performance_threshold, (
            f"Content discovery exceeded performance threshold: {execution_time}s"
        )

        # Assert - Source Distribution
        source_counts = {
            "video": sum(1 for c in content_results if c.type == "video"),
            "podcast": sum(1 for c in content_results if c.type == "podcast"),
            "book": sum(1 for c in content_results if c.type == "book")
        }

        assert all(count > 0 for count in source_counts.values()), (
            "Missing content from one or more sources"
        )

        # Assert - Content Validation
        for content in content_results:
            assert content.topic_id == topic_id
            assert content.title and content.description
            assert content.source_url
            assert content.metadata
            self.validate_content_quality(content)

    async def test_content_discovery_partial_failure(self):
        """
        Tests system resilience when some content sources fail while ensuring
        continued operation with available sources.
        """
        # Arrange
        topic_id = self._test_data["topic_id"]
        query = self._test_data["query"]

        # Configure source failures
        self._aggregator._youtube_service.search_videos = AsyncMock(
            side_effect=Exception("YouTube API error")
        )

        # Act
        content_results = await self._aggregator.discover_content(
            topic_id=topic_id,
            query=query
        )

        # Assert - Continued Operation
        assert content_results, "No content returned despite partial failures"

        # Assert - Error Handling
        source_counts = {
            "video": sum(1 for c in content_results if c.type == "video"),
            "podcast": sum(1 for c in content_results if c.type == "podcast"),
            "book": sum(1 for c in content_results if c.type == "book")
        }

        assert source_counts["video"] == 0, "Failed source returned content"
        assert source_counts["podcast"] > 0, "Working source returned no content"
        assert source_counts["book"] > 0, "Working source returned no content"

        # Assert - Quality Maintenance
        for content in content_results:
            assert content.quality_score >= self._quality_threshold

    async def test_content_quality_filtering(self):
        """
        Tests content quality assessment and filtering mechanisms across
        different quality thresholds.
        """
        # Arrange
        topic_id = self._test_data["topic_id"]
        query = self._test_data["query"]
        quality_thresholds = [0.7, 0.8, 0.9]

        for threshold in quality_thresholds:
            # Act
            filters = {"min_quality_score": threshold}
            content_results = await self._aggregator.discover_content(
                topic_id=topic_id,
                query=query,
                filters=filters
            )

            # Assert - Quality Threshold
            assert all(
                content.quality_score >= threshold 
                for content in content_results
            ), f"Content below quality threshold {threshold}"

            # Assert - Quality Distribution
            quality_scores = [content.quality_score for content in content_results]
            avg_quality = sum(quality_scores) / len(quality_scores) if quality_scores else 0

            assert avg_quality >= threshold, (
                f"Average quality {avg_quality} below threshold {threshold}"
            )

            # Assert - Metadata Quality
            for content in content_results:
                assert content.validate_metadata(), (
                    f"Invalid metadata for content: {content.id}"
                )

@pytest.fixture
def load_test_fixtures() -> Dict[str, Any]:
    """Provides test fixtures for content discovery testing."""
    return {
        "youtube_responses": {
            "search_videos": {
                "items": [
                    {"id": "video1", "snippet": {"title": "ML Tutorial"}},
                    {"id": "video2", "snippet": {"title": "AI Course"}}
                ]
            }
        },
        "spotify_responses": {
            "search_podcasts": {
                "items": [
                    {"id": "pod1", "name": "ML Podcast"},
                    {"id": "pod2", "name": "AI Show"}
                ]
            }
        },
        "books_responses": {
            "items": [
                {"volumeInfo": {"title": "ML Book", "authors": ["Author 1"]}},
                {"volumeInfo": {"title": "AI Book", "authors": ["Author 2"]}}
            ]
        }
    }