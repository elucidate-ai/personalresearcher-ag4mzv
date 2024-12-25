"""
Configuration management module for the Vector Service.
Handles environment variables, database connections, and service settings with comprehensive validation.

External Dependencies:
pydantic==2.0.0
python-dotenv==1.0.0
"""

import os
import re
from threading import local as ThreadLocal
from typing import Dict, Optional

from pydantic import BaseSettings, Field, validator
from dotenv import load_dotenv

# Thread-local storage for settings singleton
_thread_local = ThreadLocal()
_settings_instance = None

class Settings(BaseSettings):
    """
    Thread-safe Pydantic settings class for Vector Service configuration.
    Implements comprehensive validation and secure configuration management.
    """
    
    # Environment and Service Configuration
    ENV_STATE: str = Field(
        default="development",
        description="Environment state (development/staging/production)"
    )
    LOG_LEVEL: str = Field(
        default="INFO",
        description="Logging level for the service"
    )
    
    # gRPC Service Configuration
    GRPC_HOST: str = Field(
        default="0.0.0.0",
        description="gRPC server host address"
    )
    GRPC_PORT: int = Field(
        default=50051,
        description="gRPC server port"
    )
    
    # Pinecone Configuration
    PINECONE_API_KEY: str = Field(
        ...,  # Required field
        description="Pinecone API key for authentication"
    )
    PINECONE_ENVIRONMENT: str = Field(
        ...,  # Required field
        description="Pinecone environment name"
    )
    PINECONE_INDEX_NAME: str = Field(
        default="vector-index",
        description="Pinecone index name for vector storage"
    )
    PINECONE_DIMENSION: int = Field(
        default=384,  # Default for MiniLM embedding size
        description="Vector dimension size for Pinecone index"
    )
    
    # Redis Configuration
    REDIS_HOST: str = Field(
        default="localhost",
        description="Redis server host address"
    )
    REDIS_PORT: int = Field(
        default=6379,
        description="Redis server port"
    )
    REDIS_PASSWORD: Optional[str] = Field(
        default=None,
        description="Redis server password"
    )
    CACHE_TTL: int = Field(
        default=3600,  # 1 hour default
        description="Cache TTL in seconds"
    )
    
    # Internal configuration cache
    _config_cache: Dict = {}
    
    def __init__(self, **kwargs):
        """Initialize settings with environment variables and validation."""
        # Load environment variables from .env file
        try:
            load_dotenv(override=True)
        except Exception as e:
            raise RuntimeError(f"Failed to load environment variables: {str(e)}")
            
        super().__init__(**kwargs)
        self._config_cache = {}

    def get_pinecone_config(self) -> Dict:
        """
        Returns cached or new Pinecone configuration dictionary with validation.
        
        Returns:
            dict: Validated Pinecone configuration settings
        """
        if "pinecone" in self._config_cache:
            return self._config_cache["pinecone"]
            
        # Validate API key format (basic check)
        if not re.match(r'^[a-zA-Z0-9-]+$', self.PINECONE_API_KEY):
            raise ValueError("Invalid Pinecone API key format")
            
        config = {
            "api_key": self.PINECONE_API_KEY,
            "environment": self.PINECONE_ENVIRONMENT,
            "index_name": self.PINECONE_INDEX_NAME,
            "dimension": self.PINECONE_DIMENSION
        }
        
        self._config_cache["pinecone"] = config
        return config

    def get_redis_config(self) -> Dict:
        """
        Returns cached or new Redis configuration dictionary with validation.
        
        Returns:
            dict: Validated Redis configuration settings
        """
        if "redis" in self._config_cache:
            return self._config_cache["redis"]
            
        # Validate host format
        if not re.match(r'^[a-zA-Z0-9.-]+$', self.REDIS_HOST):
            raise ValueError("Invalid Redis host format")
            
        config = {
            "host": self.REDIS_HOST,
            "port": self.REDIS_PORT,
            "ttl": self.CACHE_TTL
        }
        
        # Add password if provided (avoid logging sensitive data)
        if self.REDIS_PASSWORD:
            config["password"] = self.REDIS_PASSWORD
            
        self._config_cache["redis"] = config
        return config

    @validator("PINECONE_DIMENSION")
    def validate_pinecone_dimension(cls, value: int) -> int:
        """
        Validates Pinecone dimension value.
        
        Args:
            value (int): Dimension value to validate
            
        Returns:
            int: Validated dimension value
            
        Raises:
            ValueError: If dimension is invalid
        """
        if value <= 0:
            raise ValueError("Pinecone dimension must be positive")
        if value > 10000:  # Practical upper limit
            raise ValueError("Pinecone dimension exceeds maximum allowed value")
        return value

    @validator("CACHE_TTL")
    def validate_cache_ttl(cls, value: int) -> int:
        """
        Validates cache TTL value.
        
        Args:
            value (int): TTL value to validate
            
        Returns:
            int: Validated TTL value
            
        Raises:
            ValueError: If TTL is invalid
        """
        if value <= 0:
            raise ValueError("Cache TTL must be positive")
        if value > 86400 * 7:  # Max 1 week
            raise ValueError("Cache TTL exceeds maximum allowed value (1 week)")
        return value

def load_settings() -> Settings:
    """
    Loads and validates application settings with thread safety.
    
    Returns:
        Settings: Validated settings instance
        
    Raises:
        RuntimeError: If settings initialization fails
    """
    global _settings_instance
    
    if not hasattr(_thread_local, "settings"):
        try:
            if not _settings_instance:
                _settings_instance = Settings()
            _thread_local.settings = _settings_instance
        except Exception as e:
            raise RuntimeError(f"Failed to initialize settings: {str(e)}")
            
    return _thread_local.settings