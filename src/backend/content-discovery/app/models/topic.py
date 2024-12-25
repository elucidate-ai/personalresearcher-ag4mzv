# External imports with versions specified for security and compatibility
import uuid  # latest
from datetime import datetime  # latest
from typing import Optional, List, Dict, Any, Union  # latest
from pydantic import BaseModel, validator, Field  # ^2.0.0
from cachetools import TTLCache  # ^5.0.0
import logging

# Internal imports
from ..db.mongodb import MongoDBClient

# Configure logging
logger = logging.getLogger(__name__)

# Cache configuration - 1 hour TTL, max 1000 items
topic_cache = TTLCache(maxsize=1000, ttl=3600)

class Topic(BaseModel):
    """
    Represents a knowledge topic with enhanced validation, relationship management, and caching.
    Implements comprehensive topic management with advanced relationship mapping and metadata validation.
    """
    
    # Required fields
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    name: str = Field(..., min_length=2, max_length=200)
    description: str = Field(..., min_length=10, max_length=2000)
    relevance_score: float = Field(default=0.9, ge=0.9, le=1.0)
    
    # Optional fields with defaults
    metadata: Dict[str, Any] = Field(default_factory=dict)
    related_topics: List[Dict[str, Any]] = Field(default_factory=list)
    quality_metrics: Dict[str, float] = Field(default_factory=dict)
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_verified: Optional[datetime] = None

    class Config:
        """Pydantic model configuration"""
        arbitrary_types_allowed = True
        json_encoders = {
            uuid.UUID: str,
            datetime: lambda v: v.isoformat()
        }

    def __init__(self, **data):
        """
        Initializes a new Topic instance with enhanced validation.
        
        Args:
            **data: Topic attributes including name, description, relevance_score, etc.
        """
        super().__init__(**data)
        if not self.quality_metrics:
            self.quality_metrics = {
                "content_coverage": 0.0,
                "source_reliability": 0.0,
                "information_freshness": 0.0,
                "citation_score": 0.0
            }

    @validator("metadata")
    def validate_metadata(cls, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validates topic metadata completeness and required fields.
        
        Args:
            metadata: Dictionary containing topic metadata
            
        Returns:
            Validated metadata dictionary
            
        Raises:
            ValueError: If required metadata fields are missing or invalid
        """
        required_fields = {
            "domain": str,
            "source": str,
            "language": str,
            "difficulty_level": str,
            "tags": list
        }
        
        # Ensure all required fields are present with correct types
        for field, field_type in required_fields.items():
            if field not in metadata:
                metadata[field] = "" if field_type == str else []
            elif not isinstance(metadata[field], field_type):
                raise ValueError(f"Metadata field '{field}' must be of type {field_type.__name__}")
        
        return metadata

    async def save(self) -> "Topic":
        """
        Persists topic to database with caching support.
        
        Returns:
            Updated Topic instance
            
        Raises:
            OperationFailure: If database operation fails
        """
        try:
            # Convert to dict for storage
            topic_dict = self.model_dump()
            
            # Get MongoDB client
            db_client = MongoDBClient()
            await db_client.connect()
            
            # Insert or update topic
            if await db_client.find_one("topics", {"id": str(self.id)}):
                await db_client.update_one(
                    "topics",
                    {"id": str(self.id)},
                    {"$set": topic_dict}
                )
            else:
                await db_client.insert_one("topics", topic_dict)
            
            # Update cache
            cache_key = f"topic:{self.id}"
            topic_cache[cache_key] = self
            
            logger.info(f"Successfully saved topic {self.id}")
            return self
            
        except Exception as e:
            logger.error(f"Failed to save topic {self.id}: {str(e)}")
            raise

    @classmethod
    async def find_by_id(cls, topic_id: uuid.UUID) -> Optional["Topic"]:
        """
        Retrieves topic by ID with cache support.
        
        Args:
            topic_id: UUID of topic to retrieve
            
        Returns:
            Topic instance if found, None otherwise
        """
        # Check cache first
        cache_key = f"topic:{topic_id}"
        if cache_key in topic_cache:
            return topic_cache[cache_key]
        
        try:
            # Query database
            db_client = MongoDBClient()
            await db_client.connect()
            
            topic_dict = await db_client.find_one(
                "topics",
                {"id": str(topic_id)}
            )
            
            if topic_dict:
                # Create Topic instance and cache it
                topic = cls(**topic_dict)
                topic_cache[cache_key] = topic
                return topic
                
            return None
            
        except Exception as e:
            logger.error(f"Failed to retrieve topic {topic_id}: {str(e)}")
            raise

    async def update(self, update_data: Dict[str, Any]) -> "Topic":
        """
        Updates topic with validation and cache invalidation.
        
        Args:
            update_data: Dictionary containing fields to update
            
        Returns:
            Updated Topic instance
            
        Raises:
            ValueError: If update data is invalid
        """
        # Validate relevance score if provided
        if "relevance_score" in update_data:
            if update_data["relevance_score"] < 0.9:
                raise ValueError("Relevance score must be >= 0.9")
        
        # Update fields
        for key, value in update_data.items():
            if hasattr(self, key):
                setattr(self, key, value)
        
        self.updated_at = datetime.utcnow()
        
        # Save changes
        await self.save()
        
        # Invalidate cache
        cache_key = f"topic:{self.id}"
        if cache_key in topic_cache:
            del topic_cache[cache_key]
        
        return self

    async def add_related_topic(
        self,
        related_topic_id: uuid.UUID,
        relationship_type: str,
        relationship_strength: float
    ) -> bool:
        """
        Adds bidirectional topic relationship with validation.
        
        Args:
            related_topic_id: UUID of related topic
            relationship_type: Type of relationship
            relationship_strength: Strength of relationship (0-1)
            
        Returns:
            bool indicating success
            
        Raises:
            ValueError: If relationship parameters are invalid
        """
        # Validate relationship strength
        if not 0 <= relationship_strength <= 1:
            raise ValueError("Relationship strength must be between 0 and 1")
            
        # Validate relationship type
        valid_types = {"prerequisite", "related", "subtopic", "extension"}
        if relationship_type not in valid_types:
            raise ValueError(f"Invalid relationship type. Must be one of: {valid_types}")
            
        # Get related topic
        related_topic = await self.find_by_id(related_topic_id)
        if not related_topic:
            raise ValueError(f"Related topic {related_topic_id} not found")
            
        # Add bidirectional relationship
        relationship = {
            "topic_id": str(related_topic_id),
            "type": relationship_type,
            "strength": relationship_strength,
            "created_at": datetime.utcnow()
        }
        
        reverse_relationship = {
            "topic_id": str(self.id),
            "type": relationship_type,
            "strength": relationship_strength,
            "created_at": datetime.utcnow()
        }
        
        self.related_topics.append(relationship)
        related_topic.related_topics.append(reverse_relationship)
        
        # Save both topics
        await self.save()
        await related_topic.save()
        
        return True