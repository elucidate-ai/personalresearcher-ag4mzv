"""
Configuration management module for the Knowledge Organization service.
Provides centralized configuration with enterprise features for Neo4j, Redis, and monitoring.

Version: 1.0.0
"""

import os
from typing import Dict, List, Any, Optional
from pydantic import BaseSettings, Field, validator
from dotenv import load_dotenv  # python-dotenv v1.0.0

class Settings(BaseSettings):
    """
    Comprehensive configuration management with enterprise features.
    Handles all service configuration including database, cache, and monitoring settings.
    """
    
    # Application Settings
    APP_NAME: str = Field(default="knowledge-organization-service", 
                         description="Service name for identification")
    ENV: str = Field(default="development", 
                    description="Deployment environment")
    DEBUG: bool = Field(default=False, 
                       description="Debug mode flag")

    # Logging Configuration
    LOG_LEVEL: str = Field(default="INFO", 
                          description="Logging level")
    LOG_FORMAT: str = Field(
        default='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        description="Log message format"
    )

    # Neo4j Enterprise Configuration
    NEO4J_URI: str = Field(..., 
                          description="Primary Neo4j connection URI")
    NEO4J_USER: str = Field(..., 
                           description="Neo4j authentication username")
    NEO4J_PASSWORD: str = Field(..., 
                               description="Neo4j authentication password")
    NEO4J_READ_REPLICAS: List[str] = Field(default_factory=list, 
                                          description="Neo4j read replica URIs")
    NEO4J_MAX_CONNECTIONS: int = Field(default=200, 
                                     description="Maximum connection pool size")
    NEO4J_CONNECTION_TIMEOUT: int = Field(default=5000, 
                                        description="Connection timeout in ms")
    NEO4J_MAX_CONNECTION_LIFETIME: int = Field(default=3600, 
                                             description="Max connection lifetime in seconds")
    NEO4J_CONNECTION_ACQUISITION_TIMEOUT: int = Field(
        default=60,
        description="Connection acquisition timeout in seconds"
    )

    # Monitoring Configuration
    SENTRY_DSN: Optional[str] = Field(default=None, 
                                     description="Sentry DSN for error tracking")
    SENTRY_ENVIRONMENT: str = Field(default="production", 
                                  description="Sentry environment tag")
    SENTRY_TRACES_SAMPLE_RATE: float = Field(default=0.1, 
                                           description="Sentry trace sampling rate")

    # Redis Cluster Configuration
    REDIS_URI: Optional[str] = Field(default=None, 
                                    description="Redis connection URI")
    REDIS_SENTINEL_NODES: List[str] = Field(default_factory=list, 
                                           description="Redis sentinel nodes")
    REDIS_MASTER_NAME: Optional[str] = Field(default=None, 
                                           description="Redis sentinel master name")
    REDIS_DB: int = Field(default=0, 
                         description="Redis database number")
    CACHE_TTL: int = Field(default=3600, 
                          description="Default cache TTL in seconds")
    CACHE_MAX_MEMORY: int = Field(default=1024, 
                                 description="Max cache memory in MB")
    CACHE_EVICTION_POLICY: str = Field(default="volatile-lru", 
                                      description="Cache eviction policy")

    class Config:
        env_file = f".env.{os.getenv('ENV', 'development')}"
        case_sensitive = True

    @validator("ENV")
    def validate_environment(cls, v):
        """Validate deployment environment."""
        allowed_environments = {"development", "staging", "production"}
        if v not in allowed_environments:
            raise ValueError(f"Environment must be one of {allowed_environments}")
        return v

    def get_neo4j_config(self) -> Dict[str, Any]:
        """
        Get Neo4j enterprise configuration including read replicas and connection pooling.
        
        Returns:
            Dict[str, Any]: Complete Neo4j configuration dictionary
        """
        config = {
            "uri": self.NEO4J_URI,
            "auth": (self.NEO4J_USER, self.NEO4J_PASSWORD),
            "max_connection_pool_size": self.NEO4J_MAX_CONNECTIONS,
            "connection_timeout": self.NEO4J_CONNECTION_TIMEOUT,
            "max_connection_lifetime": self.NEO4J_MAX_CONNECTION_LIFETIME,
            "connection_acquisition_timeout": self.NEO4J_CONNECTION_ACQUISITION_TIMEOUT,
            "ssl": self.ENV == "production",
            "trusted_certificates": "/etc/ssl/certs/neo4j" if self.ENV == "production" else None
        }

        if self.NEO4J_READ_REPLICAS:
            config["read_replicas"] = self.NEO4J_READ_REPLICAS

        return config

    def get_redis_config(self) -> Dict[str, Any]:
        """
        Get Redis configuration with sentinel support and cache policies.
        
        Returns:
            Dict[str, Any]: Complete Redis configuration dictionary
        """
        config = {
            "db": self.REDIS_DB,
            "socket_timeout": 5,
            "socket_connect_timeout": 5,
            "retry_on_timeout": True,
            "max_connections": 100,
            "ssl": self.ENV == "production",
            "ssl_cert_reqs": "required" if self.ENV == "production" else None,
            "cache_ttl": self.CACHE_TTL,
            "max_memory": f"{self.CACHE_MAX_MEMORY}mb",
            "maxmemory_policy": self.CACHE_EVICTION_POLICY
        }

        if self.REDIS_SENTINEL_NODES:
            config.update({
                "sentinel_nodes": self.REDIS_SENTINEL_NODES,
                "sentinel_master": self.REDIS_MASTER_NAME,
                "sentinel_kwargs": {"password": os.getenv("REDIS_SENTINEL_PASSWORD")}
            })
        else:
            config["uri"] = self.REDIS_URI

        return config

    def get_monitoring_config(self) -> Dict[str, Any]:
        """
        Get monitoring configuration including Sentry and logging settings.
        
        Returns:
            Dict[str, Any]: Complete monitoring configuration dictionary
        """
        return {
            "sentry": {
                "dsn": self.SENTRY_DSN,
                "environment": self.SENTRY_ENVIRONMENT,
                "traces_sample_rate": self.SENTRY_TRACES_SAMPLE_RATE,
                "send_default_pii": False,
                "attach_stacktrace": True,
                "request_bodies": "medium",
                "profiles_sample_rate": 0.1
            },
            "logging": {
                "level": self.LOG_LEVEL,
                "format": self.LOG_FORMAT,
                "handlers": ["console", "file"] if self.ENV == "production" else ["console"]
            }
        }

# Initialize settings instance
settings = Settings()

# Export commonly used settings
__all__ = [
    "settings",
    "Settings"
]