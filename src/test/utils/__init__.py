"""
Root initialization file for the test utilities package providing a unified interface
for testing both backend and frontend components with comprehensive monitoring,
security, and performance capabilities.

Version: 1.0.0
"""

# Import core test utilities
from .python import (
    TestBase,
    setup_test_logger,
    TestDataGenerator,
    MockFactory
)

# Package metadata
__version__ = "1.0.0"
__author__ = "Knowledge Aggregation System Team"

# Expose core functionality
__all__ = [
    # Test base and helpers
    "TestBase",
    "setup_test_logger",
    
    # Data generation
    "TestDataGenerator",
    
    # Mock factory
    "MockFactory"
]

# Initialize test logger
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
    # Initialize test environment
    from .python import setup_test_environment
    setup_test_environment(
        environment="test",
        secure_mode=True
    )
    
    # Log successful initialization
    logger.log_assertion(
        "package_initialization",
        passed=True,
        context={
            "version": __version__,
            "environment": "test"
        }
    )

except Exception as e:
    # Log initialization failure
    logger.log_assertion(
        "package_initialization",
        passed=False,
        context={
            "error": str(e),
            "version": __version__
        }
    )
    raise