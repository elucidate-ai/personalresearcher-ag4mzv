"""
Global pytest configuration and fixtures providing comprehensive test infrastructure
with enhanced security, monitoring, and resource management capabilities.

Version: 1.0.0
"""

import os
import pytest
from typing import Dict, Any, Optional
import mongomock
import redis
from neo4j import GraphDatabase
from unittest.mock import AsyncMock, MagicMock

from .utils.python.test_helpers import TestBase, load_test_data
from .utils.python.mock_factory import MockFactory
from .utils.python.data_generators import TestDataGenerator
from .utils.python.test_logger import configure_test_logger

# Global test configuration constants
TEST_ENV = "test"
MOCK_DB_URI = "mongodb://localhost:27017/test"
MOCK_REDIS_URL = "redis://localhost:6379/0"
MOCK_NEO4J_URI = "bolt://localhost:7687"
SECURITY_CONTEXT = {
    "level": "high",
    "encryption": True,
    "data_sanitization": True,
    "test_isolation": True
}
MONITORING_CONFIG = {
    "enabled": True,
    "metrics": ["performance", "security", "resources"]
}

def pytest_configure(config):
    """
    Global pytest configuration with enhanced security and monitoring setup.

    Args:
        config: Pytest config object
    """
    # Configure test logging
    logger = configure_test_logger(
        test_name="pytest_session",
        log_level="INFO",
        test_suite_context={"environment": TEST_ENV}
    )

    # Register custom markers
    config.addinivalue_line("markers", "security: mark test as security-sensitive")
    config.addinivalue_line("markers", "performance: mark test for performance monitoring")
    config.addinivalue_line("markers", "integration: mark test as integration test")

    # Configure test paths with security context
    os.environ["TEST_ENVIRONMENT"] = TEST_ENV
    os.environ["SECURITY_CONTEXT"] = str(SECURITY_CONTEXT)
    os.environ["MONITORING_CONFIG"] = str(MONITORING_CONFIG)

    # Initialize monitoring integration
    logger.test_context.update({
        "test_session_id": str(config.rootdir),
        "security_context": SECURITY_CONTEXT,
        "monitoring_config": MONITORING_CONFIG
    })

@pytest.fixture
def mock_factory() -> MockFactory:
    """
    Enhanced fixture providing MockFactory instance with monitoring and caching.

    Returns:
        Configured mock factory instance with monitoring
    """
    # Initialize mock factory with monitoring
    factory = MockFactory()
    
    # Load test fixtures with validation
    test_data = load_test_data("common_fixtures", validate_schema=True)
    
    # Configure mock responses
    youtube_responses = {
        "search_videos": {"items": [], "nextPageToken": None},
        "video_details": {"id": "test_id", "snippet": {"title": "Test Video"}}
    }
    
    spotify_responses = {
        "search_podcasts": {"items": [], "next": None},
        "episode_details": {"id": "test_id", "name": "Test Episode"}
    }
    
    # Configure error scenarios
    error_scenarios = {
        "search_error": Exception("Search failed"),
        "details_error": Exception("Details retrieval failed")
    }
    
    # Initialize factory with configurations
    factory._test_data.update(test_data)
    factory._mock_cache.clear()
    
    return factory

@pytest.fixture
def test_data_generator() -> TestDataGenerator:
    """
    Fixture providing TestDataGenerator instance with enhanced validation.

    Returns:
        Configured test data generator instance
    """
    # Configure generator with monitoring
    generator = TestDataGenerator(
        config={"fixtures_path": "test_fixtures"},
        logger=configure_test_logger("test_data_generator")
    )
    return generator

@pytest.fixture
def mock_mongodb():
    """
    Enhanced fixture providing mock MongoDB client with transaction support.

    Returns:
        Mock MongoDB client with transactions
    """
    # Configure mock client with monitoring
    client = mongomock.MongoClient(MOCK_DB_URI)
    
    # Initialize test database
    db = client.get_database("test")
    
    # Configure collections with validation
    db.create_collection("content")
    db.create_collection("topics")
    
    # Add monitoring hooks
    client.watch = MagicMock()  # Mock change streams
    client.start_session = MagicMock()  # Mock transactions
    
    return client

@pytest.fixture
def mock_redis():
    """
    Enhanced fixture providing mock Redis client with monitoring.

    Returns:
        Mock Redis client with monitoring
    """
    # Configure mock client with monitoring
    client = MagicMock()
    
    # Configure basic Redis operations
    client.get = AsyncMock()
    client.set = AsyncMock()
    client.delete = AsyncMock()
    client.exists = AsyncMock(return_value=False)
    
    # Configure connection pool
    client.connection_pool = MagicMock()
    client.connection_pool.max_connections = 10
    
    return client

@pytest.fixture
def mock_neo4j():
    """
    Enhanced fixture providing mock Neo4j session with transaction support.

    Returns:
        Mock Neo4j session with transactions
    """
    # Configure mock session with monitoring
    session = MagicMock()
    
    # Configure transaction context
    async def mock_transaction():
        tx = AsyncMock()
        tx.run = AsyncMock()
        return tx
    
    session.begin_transaction = mock_transaction
    session.close = AsyncMock()
    
    # Configure basic operations
    session.run = AsyncMock()
    session.read_transaction = AsyncMock()
    session.write_transaction = AsyncMock()
    
    return session