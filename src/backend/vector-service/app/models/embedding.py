"""
Enterprise-grade data model for vector embeddings with comprehensive validation and serialization.

External Dependencies:
numpy==1.24.0 - High-performance array operations for vector data processing

Internal Dependencies:
settings - Thread-safe access to vector dimension configuration
"""

from dataclasses import dataclass
from typing import Dict, List, ClassVar
import uuid
import numpy as np
from ..config import load_settings

@dataclass
class Embedding:
    """
    Enterprise-grade data model representing a vector embedding with associated metadata.
    Provides comprehensive validation and format conversion capabilities for vector storage integration.
    
    Attributes:
        vector (numpy.ndarray): The vector embedding array with validated dimensions
        content_id (uuid.UUID): Unique identifier for associated content
        quality_score (float): Quality assessment score between 0 and 1
        metadata (dict): Associated metadata with required schema validation
    """
    
    # Class-level constants for validation
    QUALITY_SCORE_MIN: ClassVar[float] = 0.0
    QUALITY_SCORE_MAX: ClassVar[float] = 1.0
    REQUIRED_METADATA_KEYS: ClassVar[set] = {'source', 'timestamp', 'content_type'}
    
    # Instance attributes
    vector: np.ndarray
    content_id: uuid.UUID
    quality_score: float
    metadata: Dict
    
    def __post_init__(self) -> None:
        """
        Validates all attributes after initialization.
        
        Raises:
            ValueError: If any attribute fails validation
            TypeError: If any attribute has incorrect type
        """
        self.validate()
        
    def validate(self) -> bool:
        """
        Performs comprehensive validation of the embedding instance.
        
        Returns:
            bool: True if validation passes
            
        Raises:
            ValueError: If validation fails
            TypeError: If type validation fails
        """
        # Vector validation
        if not isinstance(self.vector, np.ndarray):
            raise TypeError("Vector must be a numpy.ndarray")
            
        settings = load_settings()
        expected_dim = settings.PINECONE_DIMENSION
        
        if self.vector.shape != (expected_dim,):
            raise ValueError(f"Vector dimension must be {expected_dim}")
            
        # Content ID validation
        if not isinstance(self.content_id, uuid.UUID):
            raise TypeError("content_id must be a UUID instance")
            
        # Quality score validation
        if not isinstance(self.quality_score, float):
            raise TypeError("quality_score must be a float")
            
        if not self.QUALITY_SCORE_MIN <= self.quality_score <= self.QUALITY_SCORE_MAX:
            raise ValueError(
                f"quality_score must be between {self.QUALITY_SCORE_MIN} and {self.QUALITY_SCORE_MAX}"
            )
            
        # Metadata validation
        if not isinstance(self.metadata, dict):
            raise TypeError("metadata must be a dictionary")
            
        missing_keys = self.REQUIRED_METADATA_KEYS - set(self.metadata.keys())
        if missing_keys:
            raise ValueError(f"Missing required metadata keys: {missing_keys}")
            
        return True
        
    def to_pinecone_format(self) -> Dict:
        """
        Converts embedding to Pinecone Enterprise-compatible format with validation.
        
        Returns:
            dict: Pinecone-formatted vector data with complete metadata
            
        Raises:
            ValueError: If conversion validation fails
        """
        # Validate current state before conversion
        self.validate()
        
        # Convert vector to float64 list with validation
        vector_list = self.vector.astype(np.float64).tolist()
        if not all(isinstance(x, float) for x in vector_list):
            raise ValueError("Vector conversion to float64 list failed")
            
        # Prepare metadata with quality score
        pinecone_metadata = {
            "quality_score": self.quality_score,
            **self.metadata,
            "conversion_timestamp": str(uuid.uuid1().time)  # Add conversion tracking
        }
        
        return {
            "id": str(self.content_id),
            "values": vector_list,
            "metadata": pinecone_metadata
        }
        
    @classmethod
    def from_pinecone_format(cls, pinecone_data: Dict) -> 'Embedding':
        """
        Creates Embedding instance from Pinecone format with validation.
        
        Args:
            pinecone_data (dict): Pinecone-formatted vector data
            
        Returns:
            Embedding: New validated Embedding instance
            
        Raises:
            ValueError: If input data validation fails
            TypeError: If type conversion fails
        """
        # Validate required keys
        required_keys = {'id', 'values', 'metadata'}
        if not all(key in pinecone_data for key in required_keys):
            raise ValueError(f"Missing required keys in Pinecone data: {required_keys - set(pinecone_data.keys())}")
            
        # Extract and validate vector
        try:
            vector = np.array(pinecone_data['values'], dtype=np.float64)
        except (ValueError, TypeError) as e:
            raise ValueError(f"Failed to convert vector values: {str(e)}")
            
        # Validate content ID
        try:
            content_id = uuid.UUID(pinecone_data['id'])
        except ValueError as e:
            raise ValueError(f"Invalid content ID format: {str(e)}")
            
        # Extract metadata and quality score
        metadata = pinecone_data['metadata'].copy()
        quality_score = metadata.pop('quality_score', None)
        if quality_score is None:
            raise ValueError("Missing quality_score in metadata")
            
        # Create new instance with validation
        return cls(
            vector=vector,
            content_id=content_id,
            quality_score=float(quality_score),
            metadata=metadata
        )