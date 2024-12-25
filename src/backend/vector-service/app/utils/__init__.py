"""Vector service utilities package providing logging and common functionality.

This package exports logging utilities including setup_logging for initialization,
log_error for error handling, and a configured logger instance for use throughout
the vector service. The logging system supports structured logging with correlation IDs
and integrates with ELK Stack for comprehensive monitoring and troubleshooting capabilities.

External Dependencies:
json-logging==1.3.0
sentry-sdk==1.32.0

Version: 1.0.0
"""

from .logger import (
    setup_logging,
    log_error,
    logger
)

# Re-export core logging utilities
__all__ = [
    'setup_logging',  # Function to initialize structured logging system
    'log_error',      # Enhanced error logging with context capture
    'logger'         # Pre-configured logger instance
]

# Version information
__version__ = '1.0.0'

# Package metadata
__author__ = 'Knowledge Aggregation System Team'
__description__ = 'Vector service utilities for logging and monitoring'

# Initialize package-level logger
logger.debug(
    "Vector service utilities initialized",
    extra={
        'metadata': {
            'package': __name__,
            'version': __version__
        }
    }
)