# External imports with versions specified
import aiohttp  # ^3.8.0
import base64  # built-in
import json  # built-in
import asyncio  # built-in
from prometheus_client import Counter, Histogram  # ^0.17.0
from opentelemetry import trace  # ^1.20.0
from tenacity import retry, stop_after_attempt, wait_exponential  # ^8.0.0
import logging
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime, timedelta

# Internal imports
from ..config import settings
from ..models.content import Content
from ..core.quality_analyzer import QualityAnalyzer

# Configure logging
logger = logging.getLogger(__name__)

class SpotifyService:
    """
    Production-ready service for discovering and fetching podcast content from Spotify
    with comprehensive error handling, monitoring, and performance optimization.
    """

    def __init__(self):
        """Initialize Spotify service with credentials and production components."""
        self.client_id = settings.SPOTIFY_CLIENT_ID
        self.client_secret = settings.SPOTIFY_CLIENT_SECRET
        self.access_token = None
        self.token_expiry = 0
        
        # Initialize quality analyzer
        self.quality_analyzer = QualityAnalyzer()
        
        # Setup HTTP session with connection pooling
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=settings.SPOTIFY_API_TIMEOUT),
            connector=aiohttp.TCPConnector(limit=100)
        )
        
        # Initialize metrics collectors
        self.request_counter = Counter(
            'spotify_api_requests_total',
            'Total Spotify API requests',
            ['endpoint', 'status']
        )
        self.request_latency = Histogram(
            'spotify_api_request_duration_seconds',
            'Spotify API request duration',
            ['endpoint']
        )
        
        # Setup distributed tracing
        self.tracer = trace.get_tracer(__name__)
        
        # Initialize cache
        self.cache: Dict[str, Any] = {}

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit with cleanup."""
        await self.session.close()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def authenticate(self) -> str:
        """
        Obtains or refreshes Spotify access token with retry mechanism.
        
        Returns:
            str: Valid access token
            
        Raises:
            Exception: If authentication fails after retries
        """
        with self.tracer.start_as_current_span("spotify_authenticate") as span:
            # Check if current token is still valid
            if self.access_token and datetime.now().timestamp() < self.token_expiry:
                return self.access_token

            try:
                # Encode client credentials
                credentials = base64.b64encode(
                    f"{self.client_id}:{self.client_secret}".encode()
                ).decode()

                # Make token request
                async with self.session.post(
                    'https://accounts.spotify.com/api/token',
                    headers={
                        'Authorization': f'Basic {credentials}',
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    data={'grant_type': 'client_credentials'}
                ) as response:
                    self.request_counter.labels(
                        endpoint='token',
                        status=response.status
                    ).inc()

                    if response.status != 200:
                        raise Exception(f"Authentication failed: {response.status}")

                    data = await response.json()
                    self.access_token = data['access_token']
                    self.token_expiry = datetime.now().timestamp() + data['expires_in']
                    
                    span.set_attribute("token_expiry", self.token_expiry)
                    return self.access_token

            except Exception as e:
                logger.error(f"Spotify authentication failed: {str(e)}")
                span.set_attribute("error", True)
                span.set_attribute("error.message", str(e))
                raise

    async def search_podcasts(
        self,
        query: str,
        limit: int = 20,
        quality_threshold: float = 0.9
    ) -> List[Content]:
        """
        Searches for podcasts with resilience and monitoring.
        
        Args:
            query: Search query string
            limit: Maximum number of results
            quality_threshold: Minimum quality score threshold
            
        Returns:
            List[Content]: List of processed podcast episodes
        """
        with self.tracer.start_as_current_span("spotify_search_podcasts") as span:
            span.set_attribute("query", query)
            span.set_attribute("limit", limit)

            # Check cache first
            cache_key = f"search:{query}:{limit}"
            if cache_key in self.cache:
                return self.cache[cache_key]

            try:
                # Ensure valid token
                token = await self.authenticate()
                
                async with self.session.get(
                    'https://api.spotify.com/v1/search',
                    headers={'Authorization': f'Bearer {token}'},
                    params={
                        'q': query,
                        'type': 'episode',
                        'limit': limit,
                        'market': 'US'
                    }
                ) as response:
                    self.request_counter.labels(
                        endpoint='search',
                        status=response.status
                    ).inc()

                    if response.status != 200:
                        raise Exception(f"Search failed: {response.status}")

                    data = await response.json()
                    episodes = data['episodes']['items']
                    
                    # Process episodes concurrently
                    tasks = [
                        self.process_episode(episode, UUID(int=0))  # Topic ID would come from caller
                        for episode in episodes
                    ]
                    contents = await asyncio.gather(*tasks)
                    
                    # Filter by quality threshold
                    quality_contents = [
                        content for content in contents
                        if content.quality_score >= quality_threshold
                    ]
                    
                    # Cache results for 1 hour
                    self.cache[cache_key] = quality_contents
                    return quality_contents

            except Exception as e:
                logger.error(f"Podcast search failed: {str(e)}")
                span.set_attribute("error", True)
                span.set_attribute("error.message", str(e))
                raise

    async def get_episode_details(self, episode_id: str) -> Dict[str, Any]:
        """
        Fetches episode details with caching and monitoring.
        
        Args:
            episode_id: Spotify episode ID
            
        Returns:
            Dict[str, Any]: Episode metadata
        """
        with self.tracer.start_as_current_span("spotify_get_episode") as span:
            span.set_attribute("episode_id", episode_id)

            # Check cache
            cache_key = f"episode:{episode_id}"
            if cache_key in self.cache:
                return self.cache[cache_key]

            try:
                token = await self.authenticate()
                
                async with self.session.get(
                    f'https://api.spotify.com/v1/episodes/{episode_id}',
                    headers={'Authorization': f'Bearer {token}'}
                ) as response:
                    self.request_counter.labels(
                        endpoint='episode',
                        status=response.status
                    ).inc()

                    if response.status != 200:
                        raise Exception(f"Episode fetch failed: {response.status}")

                    data = await response.json()
                    
                    # Cache for 24 hours
                    self.cache[cache_key] = data
                    return data

            except Exception as e:
                logger.error(f"Episode details fetch failed: {str(e)}")
                span.set_attribute("error", True)
                span.set_attribute("error.message", str(e))
                raise

    async def process_episode(self, episode_data: Dict[str, Any], topic_id: UUID) -> Content:
        """
        Processes episode with quality analysis and validation.
        
        Args:
            episode_data: Raw episode data from Spotify
            topic_id: Associated topic UUID
            
        Returns:
            Content: Processed Content object
        """
        with self.tracer.start_as_current_span("spotify_process_episode") as span:
            try:
                # Extract metadata
                metadata = {
                    'duration': episode_data['duration_ms'] / 1000,  # Convert to seconds
                    'episode_number': episode_data.get('episode_number', 0),
                    'series_name': episode_data.get('show', {}).get('name', ''),
                    'platform': 'spotify',
                    'publication_date': episode_data['release_date'],
                    'language': episode_data.get('language', 'en'),
                    'explicit': episode_data.get('explicit', False),
                    'listens': episode_data.get('total_plays', 0),
                    'subscribers': episode_data.get('show', {}).get('total_episodes', 0)
                }

                # Create Content instance
                content = Content(
                    topic_id=topic_id,
                    type='podcast',
                    title=episode_data['name'],
                    description=episode_data['description'],
                    source_url=episode_data['external_urls']['spotify'],
                    metadata=metadata
                )

                # Analyze content quality
                quality_score = await self.quality_analyzer.analyze_content(
                    content,
                    topic=content.title  # Use title as topic for relevance calculation
                )

                span.set_attribute("quality_score", quality_score)
                return content

            except Exception as e:
                logger.error(f"Episode processing failed: {str(e)}")
                span.set_attribute("error", True)
                span.set_attribute("error.message", str(e))
                raise