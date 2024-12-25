"""Knowledge Organization service utility module providing comprehensive logging and monitoring capabilities.

Exports:
    - logger: Configured logging.Logger instance with JSON formatting and correlation ID support
        - info(msg: str, **kwargs): Log informational messages
        - error(msg: str, exc_info: bool = True, **kwargs): Log errors with stack traces
        - warning(msg: str, **kwargs): Log warning messages
        - debug(msg: str, **kwargs): Log debug information
    - log_error(error: Exception, context: dict = None): Log errors to both ELK and Sentry
    - get_correlation_id(): Generate or retrieve correlation ID for request tracing

Features:
    - Structured JSON logging
    - Correlation ID tracking
    - Sentry error tracking
    - Multiple log levels
    - Thread-safe logging
    - Performance optimized

Usage:
    from app.utils import logger, log_error, get_correlation_id
    
    # Log with correlation ID
    correlation_id = get_correlation_id()
    logger.info('Processing request', extra={'correlation_id': correlation_id})
    
    # Log errors with Sentry tracking
    try:
        process_data()
    except Exception as e:
        log_error(e, context={'operation': 'process_data'})
"""

# Version 1.0.0

from .logger import (
    logger,
    log_error,
    get_correlation_id,
)

# Define explicitly exported symbols
__all__ = [
    "logger",
    "log_error", 
    "get_correlation_id",
]