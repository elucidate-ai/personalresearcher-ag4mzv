"""
Integration tests for content source services (YouTube, Spotify, Google Books)
verifying proper API integration, content discovery, quality assessment functionality,
and performance metrics.

Version: 1.0.0
"""

# External imports
import pytest
import uuid
import asyncio
import time
from typing import Dict, List

# Internal imports
from test.utils.python.test_helpers import TestBase
from content_discovery.app.services.youtube_service import YouTubeService
from content_discovery.app.services.spotify_service import SpotifyService
from content_discovery.app.services.books_service import GoogleBooksService
from content_discovery.app.models.content import Content

@pytest.mark.asyncio
@pytest.mark.integration
class TestSourceIntegration(TestBase):
    """
    Comprehensive integration tests for content source services with quality 
    and performance validation.
    """

    def __init__(self):
        """Initializes test class with service instances and performance monitoring."""
        super().__init__()
        
        # Initialize test topic
        self.test_topic_id = uuid.uuid4()
        
        # Initialize services
        self.youtube_service = YouTubeService()
        self.spotify_service = SpotifyService()
        self.books_service = GoogleBooksService()
        
        # Configure performance thresholds
        self.performance_thresholds = {
            'search_time': 5.0,  # 5 seconds max per content item
            'quality_threshold': 0.9  # 90% quality threshold
        }

    async def setup_method(self, method):
        """Set up test environment before each test."""
        await super().setup_method(method)
        
        # Initialize test data isolation
        self.test_data = {
            'test_topic': 'machine learning',
            'max_results': 10,
            'test_filters': {
                'duration': 'medium',
                'language': 'en'
            }
        }

    async def test_youtube_search(self):
        """Tests YouTube video search with quality assessment and performance monitoring."""
        start_time = time.time()
        
        try:
            # Execute video search
            videos = await self.youtube_service.search_videos(
                topic_id=self.test_topic_id,
                query=self.test_data['test_topic'],
                max_results=self.test_data['max_results'],
                filters=self.test_data['test_filters']
            )
            
            # Verify results structure
            assert isinstance(videos, list), "Search should return a list"
            assert len(videos) > 0, "Search should return results"
            
            # Validate content items
            for video in videos:
                assert isinstance(video, Content), "Each item should be a Content instance"
                assert video.type == 'video', "Content type should be video"
                assert video.quality_score >= self.performance_thresholds['quality_threshold'], \
                    f"Quality score {video.quality_score} below threshold"
                
                # Verify metadata completeness
                assert all(key in video.metadata for key in [
                    'duration', 'views', 'likes', 'channel_title'
                ]), "Missing required metadata fields"
            
            # Verify performance
            processing_time = time.time() - start_time
            self.assert_performance(
                'youtube_search',
                processing_time,
                self.performance_thresholds['search_time']
            )
            
            # Test error handling
            with pytest.raises(ValueError):
                await self.youtube_service.search_videos(
                    topic_id=self.test_topic_id,
                    query="",
                    max_results=self.test_data['max_results']
                )
                
        except Exception as e:
            self.logger.error(
                "YouTube search test failed",
                extra={'error': str(e)}
            )
            raise

    async def test_spotify_podcast_search(self):
        """Tests Spotify podcast search with quality and performance validation."""
        start_time = time.time()
        
        try:
            # Execute podcast search
            podcasts = await self.spotify_service.search_podcasts(
                query=self.test_data['test_topic'],
                limit=self.test_data['max_results']
            )
            
            # Verify results structure
            assert isinstance(podcasts, list), "Search should return a list"
            assert len(podcasts) > 0, "Search should return results"
            
            # Validate content items
            for podcast in podcasts:
                assert isinstance(podcast, Content), "Each item should be a Content instance"
                assert podcast.type == 'podcast', "Content type should be podcast"
                assert podcast.quality_score >= self.performance_thresholds['quality_threshold'], \
                    f"Quality score {podcast.quality_score} below threshold"
                
                # Verify metadata completeness
                assert all(key in podcast.metadata for key in [
                    'duration', 'episode_number', 'series_name', 'platform'
                ]), "Missing required metadata fields"
            
            # Verify performance
            processing_time = time.time() - start_time
            self.assert_performance(
                'spotify_search',
                processing_time,
                self.performance_thresholds['search_time']
            )
            
            # Test error handling
            with pytest.raises(ValueError):
                await self.spotify_service.search_podcasts(
                    query="",
                    limit=self.test_data['max_results']
                )
                
        except Exception as e:
            self.logger.error(
                "Spotify search test failed",
                extra={'error': str(e)}
            )
            raise

    async def test_google_books_search(self):
        """Tests Google Books search with quality assessment and performance monitoring."""
        start_time = time.time()
        
        try:
            # Execute book search
            books = await self.books_service.search_books(
                topic=self.test_data['test_topic'],
                topic_id=self.test_topic_id,
                filters={'langRestrict': 'en'}
            )
            
            # Verify results structure
            assert isinstance(books, list), "Search should return a list"
            assert len(books) > 0, "Search should return results"
            
            # Validate content items
            for book in books:
                assert isinstance(book, Content), "Each item should be a Content instance"
                assert book.type == 'book', "Content type should be book"
                assert book.quality_score >= self.performance_thresholds['quality_threshold'], \
                    f"Quality score {book.quality_score} below threshold"
                
                # Verify metadata completeness
                assert all(key in book.metadata for key in [
                    'author', 'isbn', 'publisher', 'publication_year', 'page_count'
                ]), "Missing required metadata fields"
            
            # Verify performance
            processing_time = time.time() - start_time
            self.assert_performance(
                'books_search',
                processing_time,
                self.performance_thresholds['search_time']
            )
            
            # Test error handling
            with pytest.raises(ValueError):
                await self.books_service.search_books(
                    topic="",
                    topic_id=self.test_topic_id
                )
                
        except Exception as e:
            self.logger.error(
                "Google Books search test failed",
                extra={'error': str(e)}
            )
            raise

    async def test_content_quality_assessment(self):
        """Cross-service quality assessment validation with performance monitoring."""
        start_time = time.time()
        
        try:
            # Fetch content samples from all sources
            videos = await self.youtube_service.search_videos(
                topic_id=self.test_topic_id,
                query=self.test_data['test_topic'],
                max_results=5
            )
            
            podcasts = await self.spotify_service.search_podcasts(
                query=self.test_data['test_topic'],
                limit=5
            )
            
            books = await self.books_service.search_books(
                topic=self.test_data['test_topic'],
                topic_id=self.test_topic_id,
                filters={'maxResults': 5}
            )
            
            all_content = videos + podcasts + books
            
            # Verify quality scores
            for content in all_content:
                assert content.quality_score >= self.performance_thresholds['quality_threshold'], \
                    f"Quality score {content.quality_score} below threshold for {content.type}"
                
                # Verify content type-specific quality criteria
                if content.type == 'video':
                    assert content.metadata.get('views', 0) > 0, "Video should have views"
                elif content.type == 'podcast':
                    assert content.metadata.get('duration', 0) > 0, "Podcast should have duration"
                elif content.type == 'book':
                    assert content.metadata.get('page_count', 0) > 0, "Book should have page count"
            
            # Verify performance
            processing_time = time.time() - start_time
            self.assert_performance(
                'quality_assessment',
                processing_time,
                self.performance_thresholds['search_time'] * 3  # Combined search allowance
            )
            
        except Exception as e:
            self.logger.error(
                "Content quality assessment test failed",
                extra={'error': str(e)}
            )
            raise

def pytest_configure(config):
    """Pytest configuration function for integration test suite."""
    config.addinivalue_line(
        "markers",
        "integration: mark test as integration test"
    )