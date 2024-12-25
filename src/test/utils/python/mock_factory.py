"""
Factory class for generating mock objects and test data for backend service testing.
Provides standardized mocks for external services, API responses, and test data fixtures
with support for async operations, monitoring integration, and enhanced caching.

Version: 1.0.0
"""

import time
from typing import Dict, Optional, Any
from unittest.mock import Mock, AsyncMock, MagicMock
import pytest  # v7.0.0

from .test_helpers import load_test_data
from .test_logger import TestLogger

class MockFactory:
    """
    Factory class for creating standardized mock objects for testing with enhanced
    caching and monitoring integration.
    """

    def __init__(self, initial_data: Optional[Dict[str, Any]] = None) -> None:
        """
        Initializes mock factory with test data and monitoring integration.

        Args:
            initial_data: Optional initial test data dictionary
        """
        # Initialize test data and caching
        self._test_data: Dict[str, Any] = {}
        self._mock_cache: Dict[str, Mock] = {}
        self._logger = TestLogger(
            test_name="mock_factory",
            log_level="INFO",
            suite_context={"module": __name__}
        )

        # Load common test fixtures
        self._test_data.update(load_test_data("common_fixtures"))
        
        # Load initial data if provided
        if initial_data:
            self._test_data.update(initial_data)

    def create_youtube_service_mock(
        self,
        test_responses: Optional[Dict[str, Any]] = None,
        error_scenarios: Optional[Dict[str, Any]] = None
    ) -> Mock:
        """
        Creates a mock YouTubeService instance with configurable responses and monitoring.

        Args:
            test_responses: Optional dictionary of test responses
            error_scenarios: Optional dictionary of error scenarios

        Returns:
            Mock YouTubeService instance with configured behaviors
        """
        mock_service = MagicMock()
        cache_key = "youtube_service"

        # Return cached mock if available
        if cache_key in self._mock_cache:
            return self._mock_cache[cache_key]

        # Configure search_videos method
        async def mock_search_videos(*args, **kwargs):
            self._logger.log_assertion(
                "youtube_search_called",
                passed=True,
                context={"args": args, "kwargs": kwargs}
            )
            
            if error_scenarios and "search_error" in error_scenarios:
                raise error_scenarios["search_error"]
                
            response_data = (test_responses or {}).get("search_videos", {
                "items": [],
                "nextPageToken": None
            })
            return response_data

        mock_service.search_videos = AsyncMock(side_effect=mock_search_videos)

        # Configure get_video_details method
        async def mock_get_video_details(*args, **kwargs):
            self._logger.log_assertion(
                "youtube_details_called",
                passed=True,
                context={"args": args, "kwargs": kwargs}
            )
            
            if error_scenarios and "details_error" in error_scenarios:
                raise error_scenarios["details_error"]
                
            response_data = (test_responses or {}).get("video_details", {
                "id": "test_video_id",
                "snippet": {"title": "Test Video"}
            })
            return response_data

        mock_service.get_video_details = AsyncMock(side_effect=mock_get_video_details)

        # Configure rate limiting simulation
        mock_service.rate_limit_remaining = MagicMock(return_value=100)
        mock_service.rate_limit_reset = MagicMock(return_value=time.time() + 3600)

        # Cache the mock
        self._mock_cache[cache_key] = mock_service
        return mock_service

    def create_spotify_service_mock(
        self,
        test_responses: Optional[Dict[str, Any]] = None,
        auth_config: Optional[Dict[str, Any]] = None
    ) -> Mock:
        """
        Creates a mock SpotifyService instance with auth simulation.

        Args:
            test_responses: Optional dictionary of test responses
            auth_config: Optional authentication configuration

        Returns:
            Mock SpotifyService instance with auth simulation
        """
        mock_service = MagicMock()
        cache_key = "spotify_service"

        # Return cached mock if available
        if cache_key in self._mock_cache:
            return self._mock_cache[cache_key]

        # Configure authentication
        async def mock_authenticate():
            self._logger.log_assertion(
                "spotify_auth_called",
                passed=True,
                context={"auth_config": auth_config}
            )
            
            if auth_config and "auth_error" in auth_config:
                raise auth_config["auth_error"]
                
            return {
                "access_token": "mock_access_token",
                "expires_in": 3600
            }

        mock_service.authenticate = AsyncMock(side_effect=mock_authenticate)

        # Configure search_podcasts method
        async def mock_search_podcasts(*args, **kwargs):
            self._logger.log_assertion(
                "spotify_search_called",
                passed=True,
                context={"args": args, "kwargs": kwargs}
            )
            
            response_data = (test_responses or {}).get("search_podcasts", {
                "items": [],
                "next": None
            })
            return response_data

        mock_service.search_podcasts = AsyncMock(side_effect=mock_search_podcasts)

        # Configure get_episode_details method
        async def mock_get_episode_details(*args, **kwargs):
            self._logger.log_assertion(
                "spotify_details_called",
                passed=True,
                context={"args": args, "kwargs": kwargs}
            )
            
            response_data = (test_responses or {}).get("episode_details", {
                "id": "test_episode_id",
                "name": "Test Episode"
            })
            return response_data

        mock_service.get_episode_details = AsyncMock(side_effect=mock_get_episode_details)

        # Cache the mock
        self._mock_cache[cache_key] = mock_service
        return mock_service

    def create_api_response_mock(
        self,
        status_code: int,
        response_data: Dict[str, Any],
        headers: Optional[Dict[str, str]] = None
    ) -> Mock:
        """
        Creates a mock HTTP response object with validation.

        Args:
            status_code: HTTP status code
            response_data: Response data dictionary
            headers: Optional response headers

        Returns:
            Mock response object with headers and validation
        """
        mock_response = MagicMock()
        
        # Configure response attributes
        mock_response.status_code = status_code
        mock_response.json.return_value = response_data
        mock_response.headers = headers or {}
        
        # Add timing information
        mock_response.elapsed.total_seconds.return_value = 0.1
        
        # Log response creation
        self._logger.log_assertion(
            "api_response_created",
            passed=True,
            context={
                "status_code": status_code,
                "headers": headers
            }
        )
        
        return mock_response

    @staticmethod
    def create_async_response_mock(
        status_code: int,
        response_data: Dict[str, Any],
        delay: Optional[float] = None
    ) -> AsyncMock:
        """
        Creates a mock for async HTTP responses with context management.

        Args:
            status_code: HTTP status code
            response_data: Response data dictionary
            delay: Optional response delay in seconds

        Returns:
            Async mock response object with delay simulation
        """
        mock_response = AsyncMock()
        
        # Configure response attributes
        mock_response.status = status_code
        mock_response.json = AsyncMock(return_value=response_data)
        
        # Configure context manager methods
        async def mock_aenter(*args):
            if delay:
                await asyncio.sleep(delay)
            return mock_response
            
        async def mock_aexit(*args):
            pass
            
        mock_response.__aenter__ = AsyncMock(side_effect=mock_aenter)
        mock_response.__aexit__ = AsyncMock(side_effect=mock_aexit)
        
        return mock_response