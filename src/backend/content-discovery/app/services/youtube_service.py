# External imports with versions specified
from googleapiclient.discovery import build  # ^2.0.0
import httpx  # ^0.24.0
from tenacity import retry, stop_after_attempt, wait_exponential  # ^8.0.0
from token_bucket import TokenBucket  # ^0.3.0
from cachetools import TTLCache  # ^5.0.0
import logging
from typing import Dict, List, Optional
from uuid import UUID
from datetime import datetime, timedelta
import isodate
import asyncio

# Internal imports
from ..config import settings
from ..models.content import Content
from ..core.quality_analyzer import QualityAnalyzer

# Configure logging
logger = logging.getLogger(__name__)

class YouTubeService:
    """
    Service class for discovering and fetching video content from YouTube with enhanced 
    performance, reliability, and quality control.
    """

    def __init__(self, quality_threshold: float = 0.9):
        """
        Initializes YouTube service with API credentials and configuration.

        Args:
            quality_threshold: Minimum quality score for content inclusion
        """
        self.api_key = settings.YOUTUBE_API_KEY
        if not self.api_key:
            raise ValueError("YouTube API key is required")

        # Initialize YouTube API client
        self._youtube_client = build(
            'youtube', 
            'v3', 
            developerKey=self.api_key,
            cache_discovery=False
        )

        # Initialize quality analyzer
        self._quality_analyzer = QualityAnalyzer(quality_threshold=quality_threshold)

        # Initialize cache with 1-hour TTL
        self._cache = TTLCache(maxsize=1000, ttl=3600)

        # Initialize rate limiter (10,000 quota units per day = ~100 requests per second)
        self._rate_limiter = TokenBucket(
            rate=settings.RATE_LIMIT_PER_SECOND,
            capacity=settings.RATE_LIMIT_PER_SECOND * 2
        )

        self.quality_threshold = quality_threshold

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def search_videos(
        self,
        topic_id: UUID,
        query: str,
        max_results: Optional[int] = 50,
        filters: Optional[Dict] = None
    ) -> List[Content]:
        """
        Asynchronously searches for videos matching given topic and criteria with quality filtering.

        Args:
            topic_id: UUID of the topic being researched
            query: Search query string
            max_results: Maximum number of results to return
            filters: Optional filters for search refinement

        Returns:
            List of discovered and quality-filtered video content items

        Raises:
            ValueError: If input parameters are invalid
            Exception: If API request fails
        """
        # Input validation
        if not query or len(query.strip()) == 0:
            raise ValueError("Search query cannot be empty")

        # Check cache
        cache_key = f"search:{query}:{max_results}:{filters}"
        if cache_key in self._cache:
            logger.info(f"Returning cached results for query: {query}")
            return self._cache[cache_key]

        # Apply rate limiting
        if not self._rate_limiter.consume(1):
            await asyncio.sleep(1)  # Wait if rate limit exceeded

        try:
            # Build search request
            search_params = {
                'q': query,
                'type': 'video',
                'part': 'id,snippet',
                'maxResults': min(max_results, 50),  # API limit is 50
                'relevanceLanguage': 'en',
                'safeSearch': 'moderate',
                'videoEmbeddable': True
            }

            # Apply additional filters if provided
            if filters:
                if 'duration' in filters:
                    search_params['videoDuration'] = filters['duration']
                if 'order' in filters:
                    search_params['order'] = filters['order']

            # Execute search request
            search_response = await asyncio.to_thread(
                self._youtube_client.search().list(**search_params).execute
            )

            # Process results and fetch details
            video_ids = [item['id']['videoId'] for item in search_response.get('items', [])]
            
            # Fetch detailed video information
            content_items = []
            for video_id in video_ids:
                try:
                    video_details = await self.get_video_details(video_id)
                    
                    # Create content instance
                    content = Content(
                        topic_id=topic_id,
                        type='video',
                        title=video_details['title'],
                        description=video_details['description'],
                        source_url=f"https://www.youtube.com/watch?v={video_id}",
                        metadata=video_details
                    )

                    # Analyze content quality
                    quality_score = await self._quality_analyzer.analyze_content(
                        content=content,
                        topic=query
                    )

                    # Filter by quality threshold
                    if quality_score >= self.quality_threshold:
                        await content.save()
                        content_items.append(content)

                except Exception as e:
                    logger.error(
                        f"Error processing video {video_id}",
                        extra={"error": str(e)}
                    )
                    continue

            # Update cache
            self._cache[cache_key] = content_items
            
            logger.info(
                f"Successfully retrieved {len(content_items)} videos for query: {query}",
                extra={
                    "topic_id": str(topic_id),
                    "total_results": len(video_ids),
                    "filtered_results": len(content_items)
                }
            )

            return content_items

        except Exception as e:
            logger.error(
                "YouTube search failed",
                extra={
                    "query": query,
                    "error": str(e),
                    "topic_id": str(topic_id)
                }
            )
            raise

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def get_video_details(self, video_id: str) -> Dict:
        """
        Asynchronously fetches detailed metadata for a specific video with caching.

        Args:
            video_id: YouTube video ID

        Returns:
            Dict containing comprehensive video metadata

        Raises:
            Exception: If video details cannot be retrieved
        """
        # Check cache
        cache_key = f"video:{video_id}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        # Apply rate limiting
        if not self._rate_limiter.consume(1):
            await asyncio.sleep(1)

        try:
            # Fetch video details
            video_response = await asyncio.to_thread(
                self._youtube_client.videos().list(
                    part='snippet,contentDetails,statistics',
                    id=video_id
                ).execute
            )

            if not video_response.get('items'):
                raise ValueError(f"No details found for video ID: {video_id}")

            video_data = video_response['items'][0]
            
            # Extract and format metadata
            metadata = self.extract_metadata(video_data)
            
            # Update cache
            self._cache[cache_key] = metadata
            
            return metadata

        except Exception as e:
            logger.error(
                f"Failed to fetch video details",
                extra={
                    "video_id": video_id,
                    "error": str(e)
                }
            )
            raise

    def extract_metadata(self, video_data: Dict) -> Dict:
        """
        Extracts and validates comprehensive metadata from video response.

        Args:
            video_data: Raw video data from YouTube API

        Returns:
            Dict containing formatted and validated video metadata
        """
        snippet = video_data['snippet']
        content_details = video_data['contentDetails']
        statistics = video_data.get('statistics', {})

        # Convert duration to seconds
        duration_str = content_details.get('duration', 'PT0M0S')
        duration_seconds = int(isodate.parse_duration(duration_str).total_seconds())

        # Extract publication date
        published_at = datetime.fromisoformat(
            snippet['publishedAt'].replace('Z', '+00:00')
        )

        # Format metadata
        metadata = {
            'title': snippet['title'],
            'description': snippet['description'],
            'channel_id': snippet['channelId'],
            'channel_title': snippet['channelTitle'],
            'publication_date': published_at.isoformat(),
            'duration': duration_seconds,
            'views': int(statistics.get('viewCount', 0)),
            'likes': int(statistics.get('likeCount', 0)),
            'comments': int(statistics.get('commentCount', 0)),
            'tags': snippet.get('tags', []),
            'category_id': snippet.get('categoryId'),
            'default_language': snippet.get('defaultLanguage'),
            'default_audio_language': snippet.get('defaultAudioLanguage'),
            'has_captions': content_details.get('caption', 'false') == 'true',
            'definition': content_details.get('definition', 'sd'),
            'dimension': content_details.get('dimension', '2d'),
            'projection': content_details.get('projection', 'rectangular'),
            'thumbnails': snippet.get('thumbnails', {}),
            'live_broadcast_content': snippet.get('liveBroadcastContent', 'none'),
            'made_for_kids': video_data.get('status', {}).get('madeForKids', False)
        }

        return metadata