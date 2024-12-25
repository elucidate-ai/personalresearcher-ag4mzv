# External imports with versions specified for security and compatibility
from pydantic import BaseModel, Field, validator  # ^2.0.0
from uuid import UUID  # latest
from datetime import datetime  # latest
from typing import Optional, Dict, List, Literal  # latest

# Internal imports
from ..models.content import Content, VALID_CONTENT_TYPES, QUALITY_THRESHOLD, METADATA_REQUIREMENTS

class ContentBase(BaseModel):
    """Base schema for common content fields with comprehensive validation."""
    
    type: Literal['video', 'podcast', 'article', 'book'] = Field(
        ...,
        description="Content type - must be one of: video, podcast, article, book"
    )
    title: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Content title"
    )
    description: str = Field(
        ...,
        min_length=10,
        max_length=2000,
        description="Detailed content description"
    )
    source_url: str = Field(
        ...,
        min_length=5,
        max_length=500,
        description="Original content source URL"
    )
    quality_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Content quality score (0.0-1.0)"
    )
    metadata: Dict[str, any] = Field(
        ...,
        description="Type-specific metadata fields"
    )

    @validator('quality_score')
    def validate_quality_score(cls, value: float) -> float:
        """Validates quality score meets minimum threshold."""
        if value < QUALITY_THRESHOLD:
            raise ValueError(f"Quality score must be >= {QUALITY_THRESHOLD}")
        return value

    @validator('metadata')
    def validate_metadata(cls, value: Dict, values: Dict) -> Dict:
        """Validates metadata structure based on content type."""
        content_type = values.get('type')
        if not content_type:
            raise ValueError("Content type must be specified before metadata")

        required_fields = METADATA_REQUIREMENTS.get(content_type, [])
        
        # Check required fields presence
        missing_fields = [field for field in required_fields if field not in value]
        if missing_fields:
            raise ValueError(f"Missing required metadata fields for {content_type}: {missing_fields}")

        # Type-specific validation
        if content_type == 'video':
            if not isinstance(value.get('duration'), (int, float)):
                raise ValueError("Video duration must be numeric")
            if not isinstance(value.get('views'), int):
                raise ValueError("Video views must be integer")

        elif content_type == 'podcast':
            if not isinstance(value.get('duration'), (int, float)):
                raise ValueError("Podcast duration must be numeric")
            if not isinstance(value.get('episode_number'), int):
                raise ValueError("Episode number must be integer")

        elif content_type == 'article':
            if not isinstance(value.get('word_count'), int):
                raise ValueError("Word count must be integer")
            if not isinstance(value.get('publication_date'), str):
                raise ValueError("Publication date must be string")

        elif content_type == 'book':
            if not isinstance(value.get('page_count'), int):
                raise ValueError("Page count must be integer")
            if not isinstance(value.get('publication_year'), int):
                raise ValueError("Publication year must be integer")
            if not isinstance(value.get('isbn'), str):
                raise ValueError("ISBN must be string")

        return value

class ContentCreate(ContentBase):
    """Schema for content creation with strict validation."""
    
    topic_id: UUID = Field(
        ...,
        description="Associated topic UUID"
    )
    quality_score: Optional[float] = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Initial quality score"
    )
    metadata: Optional[Dict[str, any]] = Field(
        default={},
        description="Type-specific metadata"
    )

class ContentUpdate(BaseModel):
    """Schema for partial content updates."""
    
    title: Optional[str] = Field(
        None,
        min_length=1,
        max_length=200
    )
    description: Optional[str] = Field(
        None,
        min_length=10,
        max_length=2000
    )
    quality_score: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0
    )
    metadata: Optional[Dict[str, any]] = None

    @validator('quality_score')
    def validate_update_quality_score(cls, value: Optional[float]) -> Optional[float]:
        """Validates updated quality score if provided."""
        if value is not None and value < QUALITY_THRESHOLD:
            raise ValueError(f"Quality score must be >= {QUALITY_THRESHOLD}")
        return value

class ContentResponse(BaseModel):
    """Schema for content API responses with complete data."""
    
    id: UUID
    topic_id: UUID
    type: Literal['video', 'podcast', 'article', 'book']
    title: str
    description: str
    source_url: str
    quality_score: float
    metadata: Dict[str, any]
    created_at: datetime
    updated_at: datetime

    class Config:
        """Pydantic configuration."""
        from_attributes = True
        json_encoders = {
            UUID: str,
            datetime: lambda v: v.isoformat()
        }

class ContentList(BaseModel):
    """Schema for paginated content list responses."""
    
    items: List[ContentResponse]
    total: int = Field(..., ge=0)
    page: int = Field(..., ge=1)
    size: int = Field(..., ge=1, le=100)