"""
Centralized logging utility for the Knowledge Organization service.
Provides structured logging with correlation IDs, log levels, and monitoring system integration.

Version: 1.0.0
"""

import logging
import json
import sys
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from logging.handlers import TimedRotatingFileHandler
from pythonjsonlogger.jsonlogger import JsonFormatter  # pythonjsonlogger v2.0.0
import sentry_sdk  # sentry-sdk v1.0.0
from sentry_sdk.integrations.logging import LoggingIntegration
import threading
import uuid
from ..config import settings

# Initialize thread-local storage for correlation IDs
_thread_local = threading.local()

# Initialize logger
logger = logging.getLogger('knowledge-organization')

class EnhancedJsonFormatter(JsonFormatter):
    """
    Custom JSON formatter with additional fields and ISO format timestamps.
    """
    def add_fields(self, log_record: Dict[str, Any], record: logging.LogRecord, message_dict: Dict[str, Any]) -> None:
        """
        Add enhanced fields to the log record.
        """
        super().add_fields(log_record, record, message_dict)
        
        # Add ISO format timestamp
        log_record['timestamp'] = datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat()
        
        # Add correlation ID
        log_record['correlation_id'] = getattr(record, 'correlation_id', get_correlation_id())
        
        # Add environment and service information
        log_record['environment'] = settings.ENV
        log_record['service'] = 'knowledge-organization'
        
        # Add log level name
        log_record['level'] = record.levelname
        
        # Add file and line information for non-INFO levels
        if record.levelno >= logging.WARNING:
            log_record['file'] = record.filename
            log_record['line'] = record.lineno
            log_record['function'] = record.funcName

def setup_logging() -> logging.Logger:
    """
    Configure the logging system with appropriate handlers, formatters, and monitoring integrations.
    
    Returns:
        logging.Logger: Configured logger instance
    """
    # Clear any existing handlers
    logger.handlers.clear()
    
    # Set base log level
    logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper()))
    
    # Create JSON formatter
    formatter = EnhancedJsonFormatter(
        fmt='%(timestamp)s %(level)s %(correlation_id)s %(message)s',
        json_ensure_ascii=False
    )
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # File handler for error logs in production
    if settings.ENV == 'production':
        file_handler = TimedRotatingFileHandler(
            filename='logs/knowledge-organization-error.log',
            when='midnight',
            interval=1,
            backupCount=7,
            encoding='utf-8'
        )
        file_handler.setLevel(logging.ERROR)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    # Configure Sentry integration if DSN is provided
    if settings.SENTRY_DSN:
        sentry_logging = LoggingIntegration(
            level=logging.ERROR,
            event_level=logging.ERROR
        )
        
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENV,
            traces_sample_rate=0.1,
            integrations=[sentry_logging],
            attach_stacktrace=True
        )
    
    return logger

def get_correlation_id() -> str:
    """
    Retrieve or generate correlation ID for request tracing with thread safety.
    
    Returns:
        str: Unique correlation ID for request tracing
    """
    if not hasattr(_thread_local, 'correlation_id'):
        _thread_local.correlation_id = str(uuid.uuid4())
    return _thread_local.correlation_id

def set_correlation_id(correlation_id: Optional[str] = None) -> None:
    """
    Set correlation ID for the current thread.
    
    Args:
        correlation_id: Optional correlation ID to set. If None, generates new UUID.
    """
    _thread_local.correlation_id = correlation_id or str(uuid.uuid4())

def log_error(error: Exception, metadata: Dict[str, Any] = None) -> None:
    """
    Enhanced error logging with Sentry integration and detailed context capture.
    
    Args:
        error: Exception instance to log
        metadata: Additional context to include with the error
    """
    try:
        error_context = {
            'error_type': error.__class__.__name__,
            'error_message': str(error),
            'correlation_id': get_correlation_id(),
            'environment': settings.ENV,
            'service': 'knowledge-organization'
        }
        
        if metadata:
            # Sanitize sensitive information
            safe_metadata = {
                k: v for k, v in metadata.items() 
                if not any(sensitive in k.lower() 
                          for sensitive in ['password', 'token', 'secret', 'key'])
            }
            error_context.update(safe_metadata)
        
        # Log to file/console
        logger.error(
            json.dumps(error_context),
            exc_info=True,
            extra={'correlation_id': get_correlation_id()}
        )
        
        # Report to Sentry if configured
        if settings.SENTRY_DSN:
            with sentry_sdk.push_scope() as scope:
                scope.set_context('error_context', error_context)
                sentry_sdk.capture_exception(error)
                
    except Exception as logging_error:
        # Fallback logging if error logging fails
        sys.stderr.write(f"Error during error logging: {str(logging_error)}\n")
        sys.stderr.write(f"Original error: {str(error)}\n")

# Initialize logging on module import
setup_logging()

# Export commonly used functions and logger instance
__all__ = [
    'logger',
    'log_error',
    'get_correlation_id',
    'set_correlation_id'
]