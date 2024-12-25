# External imports with versions specified for security and compatibility
import aiohttp  # ^3.8.0
import asyncio
from typing import List, Optional, Dict, Any
import json
import time
from uuid import UUID

# Internal imports
from ..models.content import Content
from ..config import settings
from ..utils.logger import logger

class GoogleBooksService:
    """
    Enhanced service class for Google Books API interaction with robust error handling,
    performance monitoring, and quality assessment capabilities.
    """

    def __init__(self):
        """
        Initializes Google Books service with enhanced configuration and connection pooling.
        """
        self._api_key = settings.GOOGLE_BOOKS_API_KEY
        self._base_url = "https://www.googleapis.com/books/v1/volumes"
        self._timeout = settings.REQUEST_TIMEOUT
        self._max_retries = settings.MAX_RETRIES
        self._min_quality_threshold = 0.9  # 90% relevance threshold
        self._session = None

    async def __aenter__(self):
        """Sets up aiohttp session with connection pooling."""
        self._session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=self._timeout),
            connector=aiohttp.TCPConnector(
                limit=100,  # Connection pool size
                ttl_dns_cache=300,  # DNS cache TTL
                enable_cleanup_closed=True
            )
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Ensures proper cleanup of aiohttp session."""
        if self._session:
            await self._session.close()

    async def search_books(
        self,
        topic: str,
        topic_id: UUID,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Content]:
        """
        Searches for books with enhanced error handling and performance monitoring.

        Args:
            topic: Search topic
            topic_id: Associated topic ID
            filters: Optional search filters

        Returns:
            List of high-quality book content items

        Raises:
            ValueError: If topic is invalid
            RuntimeError: If API request fails repeatedly
        """
        start_time = time.time()
        logger.info(f"Starting book search for topic: {topic}", extra={"topic_id": str(topic_id)})

        if not topic.strip():
            raise ValueError("Topic cannot be empty")

        # Construct optimized search query
        query_params = {
            "q": topic,
            "key": self._api_key,
            "maxResults": 40,  # Fetch more to allow for quality filtering
            "langRestrict": "en",
            "printType": "books",
            "orderBy": "relevance"
        }

        # Apply additional filters if provided
        if filters:
            query_params.update(filters)

        content_items = []
        retry_count = 0

        while retry_count < self._max_retries:
            try:
                async with self._session.get(
                    self._base_url,
                    params=query_params,
                    raise_for_status=True
                ) as response:
                    data = await response.json()

                    if "items" not in data:
                        logger.warning(
                            "No books found for topic",
                            extra={
                                "topic": topic,
                                "topic_id": str(topic_id)
                            }
                        )
                        break

                    # Process books with quality assessment
                    for book in data["items"]:
                        content = await self._process_book(book, topic_id)
                        if content:
                            content_items.append(content)

                    break  # Success, exit retry loop

            except aiohttp.ClientError as e:
                retry_count += 1
                if retry_count == self._max_retries:
                    logger.error(
                        "Failed to fetch books after retries",
                        extra={
                            "topic": topic,
                            "topic_id": str(topic_id),
                            "error": str(e)
                        }
                    )
                    raise RuntimeError(f"Failed to fetch books: {str(e)}")
                
                await asyncio.sleep(2 ** retry_count)  # Exponential backoff

        processing_time = time.time() - start_time
        logger.info(
            "Book search completed",
            extra={
                "topic": topic,
                "topic_id": str(topic_id),
                "items_found": len(content_items),
                "processing_time": processing_time
            }
        )

        return content_items

    async def _process_book(self, book_data: Dict[str, Any], topic_id: UUID) -> Optional[Content]:
        """
        Enhanced book data processing with strict validation and quality assessment.

        Args:
            book_data: Raw book data from API
            topic_id: Associated topic ID

        Returns:
            Processed and validated Content object or None if invalid
        """
        try:
            volume_info = book_data.get("volumeInfo", {})
            
            # Validate required fields
            if not all(key in volume_info for key in ["title", "authors", "publisher"]):
                return None

            # Calculate quality score
            quality_score = self._calculate_quality_score(volume_info)
            
            if quality_score < self._min_quality_threshold:
                logger.debug(
                    "Book below quality threshold",
                    extra={
                        "title": volume_info.get("title"),
                        "quality_score": quality_score
                    }
                )
                return None

            # Prepare metadata
            metadata = {
                "author": volume_info.get("authors", ["Unknown"])[0],
                "publisher": volume_info.get("publisher", "Unknown"),
                "publication_year": int(volume_info.get("publishedDate", "0")[:4]),
                "isbn": volume_info.get("industryIdentifiers", [{}])[0].get("identifier", ""),
                "page_count": volume_info.get("pageCount", 0),
                "categories": volume_info.get("categories", []),
                "language": volume_info.get("language", "unknown"),
                "average_rating": volume_info.get("averageRating", 0.0),
                "ratings_count": volume_info.get("ratingsCount", 0)
            }

            # Create content object
            content = Content(
                topic_id=topic_id,
                type="book",
                title=volume_info["title"],
                description=volume_info.get("description", ""),
                source_url=volume_info.get("infoLink", ""),
                quality_score=quality_score,
                metadata=metadata
            )

            # Persist to database
            await content.save()
            return content

        except Exception as e:
            logger.error(
                "Error processing book",
                extra={
                    "topic_id": str(topic_id),
                    "error": str(e),
                    "book_data": book_data
                }
            )
            return None

    def _calculate_quality_score(self, book_data: Dict[str, Any]) -> float:
        """
        Enhanced quality scoring with strict relevance criteria.

        Args:
            book_data: Book metadata for quality assessment

        Returns:
            Quality score between 0 and 1
        """
        score = 0.0
        weights = {
            "metadata_completeness": 0.3,
            "content_quality": 0.3,
            "user_ratings": 0.2,
            "publication_info": 0.2
        }

        # Metadata completeness (30%)
        required_fields = ["title", "authors", "publisher", "description", "pageCount"]
        metadata_score = sum(1 for field in required_fields if field in book_data) / len(required_fields)
        score += metadata_score * weights["metadata_completeness"]

        # Content quality (30%)
        content_score = 0.0
        if book_data.get("description"):
            desc_length = len(book_data["description"])
            content_score += min(desc_length / 1000, 1.0) * 0.5  # Description length
        if book_data.get("categories"):
            content_score += 0.5  # Has categories
        score += content_score * weights["content_quality"]

        # User ratings (20%)
        rating_score = 0.0
        if book_data.get("averageRating"):
            rating_score += (book_data["averageRating"] / 5.0) * 0.6
        if book_data.get("ratingsCount", 0) > 0:
            rating_score += min(book_data["ratingsCount"] / 100, 1.0) * 0.4
        score += rating_score * weights["user_ratings"]

        # Publication information (20%)
        pub_score = 0.0
        if book_data.get("publisher"):
            pub_score += 0.5
        if book_data.get("publishedDate"):
            pub_score += 0.5
        score += pub_score * weights["publication_info"]

        return round(score, 2)