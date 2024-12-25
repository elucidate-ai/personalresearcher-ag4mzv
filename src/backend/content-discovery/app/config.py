# External imports - versions specified for security and compatibility
import os
from pydantic_settings import BaseSettings  # v2.0.0
from pydantic import Field, validator  # v2.0.0
from typing import Dict, Any
from urllib.parse import urlparse
import ssl

# Valid configuration values
VALID_ENVIRONMENTS = ['development', 'staging', 'production']
LOG_LEVELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']

class Settings(BaseSettings):
    """
    Configuration settings for the Content Discovery Service with comprehensive validation
    and security features. Manages environment variables, API keys, database connections,
    and service parameters.
    """
    
    # Application settings
    APP_NAME: str = Field(
        default="content-discovery-service",
        description="Name of the service for identification"
    )
    
    ENV: str = Field(
        default="development",
        description="Deployment environment"
    )
    
    DEBUG: bool = Field(
        default=False,
        description="Debug mode flag"
    )
    
    API_PREFIX: str = Field(
        default="/api/v1",
        description="API route prefix"
    )
    
    # Database settings
    MONGODB_URI: str = Field(
        default="mongodb://localhost:27017",
        description="MongoDB connection URI"
    )
    
    MONGODB_DB_NAME: str = Field(
        default="content_discovery",
        description="MongoDB database name"
    )
    
    REDIS_URI: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URI"
    )
    
    # Third-party API credentials
    YOUTUBE_API_KEY: str = Field(
        default="",
        description="YouTube Data API v3 key"
    )
    
    SPOTIFY_CLIENT_ID: str = Field(
        default="",
        description="Spotify API client ID"
    )
    
    SPOTIFY_CLIENT_SECRET: str = Field(
        default="",
        description="Spotify API client secret"
    )
    
    GOOGLE_BOOKS_API_KEY: str = Field(
        default="",
        description="Google Books API key"
    )
    
    # Service parameters
    MAX_CONTENT_ITEMS: int = Field(
        default=1000,
        description="Maximum number of content items to process"
    )
    
    MIN_QUALITY_SCORE: float = Field(
        default=0.7,
        description="Minimum quality score for content inclusion",
        ge=0.0,
        le=1.0
    )
    
    CONTENT_CACHE_TTL: int = Field(
        default=3600,
        description="Content cache time-to-live in seconds"
    )
    
    REQUEST_TIMEOUT: int = Field(
        default=30,
        description="HTTP request timeout in seconds"
    )
    
    # Monitoring settings
    SENTRY_DSN: str = Field(
        default="",
        description="Sentry error tracking DSN"
    )
    
    LOG_LEVEL: str = Field(
        default="INFO",
        description="Logging level"
    )

    class Config:
        """Pydantic configuration"""
        env_file = ".env"
        case_sensitive = True
        
    @validator('ENV')
    def validate_environment(cls, env_value: str) -> str:
        """
        Validates the environment setting against allowed values.
        
        Args:
            env_value: Environment value to validate
            
        Returns:
            Validated environment value
            
        Raises:
            ValueError: If environment value is invalid
        """
        if env_value not in VALID_ENVIRONMENTS:
            raise ValueError(f"Environment must be one of: {VALID_ENVIRONMENTS}")
        return env_value

    @validator('LOG_LEVEL')
    def validate_log_level(cls, log_level: str) -> str:
        """
        Validates logging level against allowed values.
        
        Args:
            log_level: Logging level to validate
            
        Returns:
            Validated log level
            
        Raises:
            ValueError: If log level is invalid
        """
        if log_level not in LOG_LEVELS:
            raise ValueError(f"Log level must be one of: {LOG_LEVELS}")
        return log_level

    def get_mongodb_settings(self) -> Dict[str, Any]:
        """
        Returns validated MongoDB connection settings with security options.
        
        Returns:
            Dict containing secure MongoDB connection parameters
        """
        parsed_uri = urlparse(self.MONGODB_URI)
        
        return {
            "host": self.MONGODB_URI,
            "db": self.MONGODB_DB_NAME,
            "ssl": self.ENV != "development",
            "ssl_cert_reqs": ssl.CERT_REQUIRED if self.ENV == "production" else ssl.CERT_NONE,
            "connectTimeoutMS": 5000,
            "serverSelectionTimeoutMS": 5000,
            "maxPoolSize": 100,
            "minPoolSize": 10,
            "maxIdleTimeMS": 50000,
            "retryWrites": True,
            "w": "majority"
        }

    def get_redis_settings(self) -> Dict[str, Any]:
        """
        Returns validated Redis connection settings with security options.
        
        Returns:
            Dict containing secure Redis connection parameters
        """
        parsed_uri = urlparse(self.REDIS_URI)
        
        return {
            "url": self.REDIS_URI,
            "ssl": self.ENV != "development",
            "ssl_cert_reqs": ssl.CERT_REQUIRED if self.ENV == "production" else ssl.CERT_NONE,
            "socket_timeout": 5,
            "socket_connect_timeout": 5,
            "socket_keepalive": True,
            "retry_on_timeout": True,
            "max_connections": 100,
            "encoding": "utf-8",
            "decode_responses": True
        }

    def validate_api_keys(self) -> None:
        """
        Validates that required API keys are present for the current environment.
        
        Raises:
            ValueError: If required API keys are missing in production
        """
        if self.ENV == "production":
            if not self.YOUTUBE_API_KEY:
                raise ValueError("YouTube API key is required in production")
            if not self.SPOTIFY_CLIENT_ID or not self.SPOTIFY_CLIENT_SECRET:
                raise ValueError("Spotify API credentials are required in production")
            if not self.GOOGLE_BOOKS_API_KEY:
                raise ValueError("Google Books API key is required in production")

# Create and export settings instance
settings = Settings()

# Validate API keys on module load
settings.validate_api_keys()