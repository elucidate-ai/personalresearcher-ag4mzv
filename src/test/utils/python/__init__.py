"""
Python test utilities package providing comprehensive testing infrastructure with
enhanced monitoring, security, and performance capabilities.

Version: 1.0.0
"""

# Import core test utilities
from .test_helpers import (
    TestBase,
    setup_test_environment,
    mock_response,
    load_test_data
)

# Import test data generation utilities
from .data_generators import (
    TestDataGenerator,
    generate_content,
    generate_content_batch,
    generate_quality_scores,
    generate_metadata
)

# Import mock factory utilities
from .mock_factory import (
    MockFactory,
    setup_mock_factory
)

# Package metadata
__version__ = "1.0.0"
__author__ = "Knowledge Aggregation System Team"

# Expose core functionality
__all__ = [
    # Test base and helpers
    "TestBase",
    "setup_test_environment",
    "mock_response",
    "load_test_data",
    
    # Data generation
    "TestDataGenerator",
    "generate_content",
    "generate_content_batch", 
    "generate_quality_scores",
    "generate_metadata",
    
    # Mock factory
    "MockFactory",
    "setup_mock_factory"
]

# Initialize test logger
from .test_helpers import setup_test_logger
logger = setup_test_logger(
    test_name="test_utils",
    log_level="INFO",
    test_suite_context={"package": __name__}
)

def get_version() -> str:
    """Returns the package version."""
    return __version__

def get_test_logger():
    """Returns the configured test logger instance."""
    return logger

# Validate environment on import
try:
    setup_test_environment(
        environment="test",
        secure_mode=True
    )
    logger.log_assertion(
        "package_initialization",
        passed=True,
        context={"version": __version__}
    )
except Exception as e:
    logger.log_assertion(
        "package_initialization",
        passed=False,
        context={"error": str(e)}
    )
    raise