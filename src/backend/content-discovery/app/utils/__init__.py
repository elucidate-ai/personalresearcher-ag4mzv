"""
Content Discovery Service Utilities Package
Provides centralized logging and monitoring functionality with structured logging,
error tracking, and environment-aware configuration.

Version: 1.0.0
"""

from .logger import setup_logging, get_logger, logger

__all__ = [
    'setup_logging',
    'get_logger',
    'logger'
]

# Initialize default logger instance with production-ready configuration
setup_logging()

# Configure default logger with service context
logger = get_logger(__name__)

# Add version info to logger context
logger = logger.bind(
    service="content-discovery",
    version="1.0.0"
)

# Log initialization status
logger.info(
    "Content Discovery Service utilities initialized",
    module="utils",
    status="initialized"
)