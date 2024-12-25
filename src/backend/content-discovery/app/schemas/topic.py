# External imports with versions specified for security and compatibility
from pydantic import BaseModel, Field, validator  # ^2.0.0
from typing import List, Optional, Dict, Union, Literal, Annotated  # latest
from uuid import UUID  # latest
from datetime import datetime  # latest
import re
import logging

# Internal imports
from ..models.topic import Topic

# Configure logging
logger = logging.getLogger(__name__)

# Constants for validation
NAME_PATTERN = re.compile(r'^[a-zA-Z0-9-_\s]+$')
SQL_INJECTION_PATTERNS = [
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'UNION', '--', ';'
]

class TopicBase(BaseModel):
    """
    Base schema for topic validation with enhanced field validation and security features.
    """
    name: Annotated[str, Field(
        min_length=3,
        max_length=100,
        pattern='^[a-zA-Z0-9-_\s]+$',
        example='machine-learning',
        description='Topic name with alphanumeric characters, spaces, hyphens and underscores'
    )]
    
    description: Annotated[str, Field(
        min_length=10,
        max_length=1000,
        example='Comprehensive guide to machine learning concepts',
        description='Detailed description of the topic'
    )]
    
    relevance_score: Annotated[Optional[float], Field(
        ge=0.0,
        le=1.0,
        example=0.95,
        description='Topic relevance score between 0 and 1'
    )] = None
    
    metadata: Optional[Dict[str, Annotated[str, Field(
        max_length=500,
        description='Additional topic metadata'
    )]]] = None

    class Config:
        """Pydantic model configuration with performance optimizations"""
        from_attributes = True
        validate_assignment = True
        json_schema_extra = {
            "example": {
                "name": "machine-learning",
                "description": "Comprehensive guide to machine learning concepts",
                "relevance_score": 0.95,
                "metadata": {
                    "domain": "computer-science",
                    "difficulty": "intermediate"
                }
            }
        }

    @validator('name')
    def validate_name(cls, value: str) -> str:
        """
        Custom name validator with security checks.
        
        Args:
            value: Topic name to validate
            
        Returns:
            Validated name string
            
        Raises:
            ValueError: If name contains invalid characters or SQL injection patterns
        """
        # Check for SQL injection patterns
        value_upper = value.upper()
        for pattern in SQL_INJECTION_PATTERNS:
            if pattern in value_upper:
                raise ValueError(f"Name contains forbidden pattern: {pattern}")
        
        # Validate against allowed pattern
        if not NAME_PATTERN.match(value):
            raise ValueError("Name must contain only alphanumeric characters, spaces, hyphens and underscores")
        
        return value.strip()

class TopicCreate(TopicBase):
    """Schema for topic creation with relationship validation"""
    related_topics: Optional[List[Dict[str, Union[
        UUID,  # related topic id
        Literal['related', 'prerequisite', 'extension'],  # relationship type
        float  # relationship strength
    ]]]] = Field(
        default=None,
        description='List of related topics with relationship metadata'
    )

    @validator('related_topics')
    def validate_related_topics(cls, value: Optional[List[Dict]]) -> Optional[List[Dict]]:
        """Validates related topics structure and relationship strength"""
        if value is None:
            return value
            
        for relation in value:
            if 'strength' in relation and not 0 <= relation['strength'] <= 1:
                raise ValueError("Relationship strength must be between 0 and 1")
        return value

class TopicUpdate(BaseModel):
    """Schema for topic updates with partial validation"""
    name: Optional[str] = None
    description: Optional[str] = None
    relevance_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    metadata: Optional[Dict] = None
    related_topics: Optional[List[Dict[str, Union[UUID, str, float]]]] = None

    @validator('name')
    def validate_update_name(cls, value: Optional[str]) -> Optional[str]:
        """Validates name updates using TopicBase validator"""
        if value is not None:
            return TopicBase.validate_name(value)
        return value

class TopicResponse(TopicBase):
    """Schema for API responses with comprehensive metadata"""
    id: UUID
    created_at: datetime
    updated_at: datetime
    analytics: Optional[Dict[str, Any]] = Field(
        default=None,
        description='Topic analytics and usage statistics'
    )

    class Config:
        """Response model configuration"""
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: str
        }

class TopicList(BaseModel):
    """Schema for paginated topic lists with metadata"""
    items: List[TopicResponse]
    total: int = Field(..., ge=0, description='Total number of topics')
    page: int = Field(..., ge=1, description='Current page number')
    size: int = Field(..., ge=1, le=100, description='Items per page')
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description='Additional response metadata'
    )