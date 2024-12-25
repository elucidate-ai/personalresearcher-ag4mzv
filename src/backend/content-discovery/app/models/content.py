# External imports with versions specified for security and compatibility
from uuid import UUID, uuid4  # latest
from datetime import datetime  # latest
from typing import Optional, Dict, Any, List  # latest
import logging

# Internal imports
from ..db.mongodb import MongoDBClient

# Configure logging
logger = logging.getLogger(__name__)

# Constants for content validation and quality control
VALID_CONTENT_TYPES = ['video', 'podcast', 'article', 'book']
QUALITY_THRESHOLD = 0.9
MAX_RETRY_ATTEMPTS = 3

# Type-specific metadata requirements
METADATA_REQUIREMENTS = {
    'video': ['duration', 'resolution', 'platform', 'views'],
    'podcast': ['duration', 'episode_number', 'series_name', 'platform'],
    'article': ['author', 'publication_date', 'publisher', 'word_count'],
    'book': ['author', 'isbn', 'publisher', 'publication_year', 'page_count']
}

class Content:
    """
    Enhanced model class representing a content item with comprehensive validation 
    and quality control mechanisms.
    """

    def __init__(
        self,
        topic_id: UUID,
        type: str,
        title: str,
        description: str,
        source_url: str,
        quality_score: Optional[float] = 0.0,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Initialize a new Content instance with enhanced validation.

        Args:
            topic_id: UUID of associated topic
            type: Content type (video, podcast, article, book)
            title: Content title
            description: Content description
            source_url: Source URL of content
            quality_score: Initial quality score (0.0-1.0)
            metadata: Type-specific metadata dictionary

        Raises:
            ValueError: If content type is invalid or required fields are missing
        """
        if type not in VALID_CONTENT_TYPES:
            raise ValueError(f"Invalid content type. Must be one of: {VALID_CONTENT_TYPES}")

        self.id = uuid4()
        self.topic_id = topic_id
        self.type = type
        self.title = title
        self.description = description
        self.source_url = source_url
        self.quality_score = quality_score
        self.metadata = metadata or {}
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        self.version = 1  # For optimistic locking

        # Validate metadata on initialization
        if not self.validate_metadata():
            raise ValueError(f"Invalid or incomplete metadata for content type: {type}")

    async def save(self) -> Dict[str, Any]:
        """
        Persists content item to database with retry logic and optimistic locking.

        Returns:
            Dict containing saved content document

        Raises:
            OperationFailure: If database operation fails
            ValueError: If content validation fails
        """
        if not self.validate_metadata():
            raise ValueError("Content metadata validation failed")

        db_client = MongoDBClient()
        await db_client.connect()

        content_dict = {
            "id": str(self.id),
            "topic_id": str(self.topic_id),
            "type": self.type,
            "title": self.title,
            "description": self.description,
            "source_url": self.source_url,
            "quality_score": self.quality_score,
            "metadata": self.metadata,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "version": self.version
        }

        for attempt in range(MAX_RETRY_ATTEMPTS):
            try:
                # Check for existing document
                existing = await db_client.find_one(
                    "content",
                    {"id": str(self.id)}
                )

                if existing:
                    # Update with optimistic locking
                    if existing["version"] != self.version:
                        raise ValueError("Content version conflict")
                    
                    content_dict["version"] += 1
                    result = await db_client.update_one(
                        "content",
                        {"id": str(self.id), "version": self.version},
                        {"$set": content_dict}
                    )
                else:
                    # Insert new document
                    result = await db_client.insert_one("content", content_dict)

                self.version = content_dict["version"]
                return content_dict

            except Exception as e:
                if attempt == MAX_RETRY_ATTEMPTS - 1:
                    logger.error(
                        "Failed to save content after retries",
                        extra={
                            "content_id": str(self.id),
                            "error": str(e),
                            "attempt": attempt + 1
                        }
                    )
                    raise
                continue

    async def update_quality_score(self, new_score: float) -> bool:
        """
        Updates the quality score with enhanced validation.

        Args:
            new_score: New quality score value (0.0-1.0)

        Returns:
            bool indicating update success

        Raises:
            ValueError: If quality score is invalid
        """
        if not 0 <= new_score <= 1:
            raise ValueError("Quality score must be between 0 and 1")

        if new_score < QUALITY_THRESHOLD:
            logger.warning(
                f"Quality score below threshold: {new_score}",
                extra={"content_id": str(self.id)}
            )

        self.quality_score = new_score
        self.updated_at = datetime.utcnow()
        self.version += 1

        try:
            db_client = MongoDBClient()
            await db_client.connect()
            
            result = await db_client.update_one(
                "content",
                {"id": str(self.id), "version": self.version - 1},
                {
                    "$set": {
                        "quality_score": self.quality_score,
                        "updated_at": self.updated_at,
                        "version": self.version
                    }
                }
            )
            return result

        except Exception as e:
            logger.error(
                "Failed to update quality score",
                extra={
                    "content_id": str(self.id),
                    "error": str(e)
                }
            )
            return False

    def validate_metadata(self) -> bool:
        """
        Validates metadata based on content type requirements.

        Returns:
            bool indicating validation status
        """
        if not self.metadata:
            return False

        required_fields = METADATA_REQUIREMENTS.get(self.type, [])
        
        # Check for required fields
        for field in required_fields:
            if field not in self.metadata:
                logger.error(
                    f"Missing required metadata field: {field}",
                    extra={
                        "content_id": str(self.id),
                        "content_type": self.type
                    }
                )
                return False

        # Type-specific validation
        try:
            if self.type == 'video':
                if not isinstance(self.metadata['duration'], (int, float)):
                    return False
                if not isinstance(self.metadata['views'], int):
                    return False

            elif self.type == 'podcast':
                if not isinstance(self.metadata['duration'], (int, float)):
                    return False
                if not isinstance(self.metadata['episode_number'], int):
                    return False

            elif self.type == 'article':
                if not isinstance(self.metadata['word_count'], int):
                    return False
                if not isinstance(self.metadata['publication_date'], str):
                    return False

            elif self.type == 'book':
                if not isinstance(self.metadata['page_count'], int):
                    return False
                if not isinstance(self.metadata['publication_year'], int):
                    return False
                if not isinstance(self.metadata['isbn'], str):
                    return False

            return True

        except (KeyError, TypeError) as e:
            logger.error(
                "Metadata validation error",
                extra={
                    "content_id": str(self.id),
                    "error": str(e)
                }
            )
            return False