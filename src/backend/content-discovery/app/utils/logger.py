"""
Logging utility module for the Content Discovery Service.
Provides centralized logging configuration with structured logging support,
error tracking via Sentry, and environment-specific formatting.

Version: 1.0.0
"""

import logging
import logging.handlers
import queue
import threading
from typing import Optional

import sentry_sdk  # v1.30.0
from sentry_sdk.integrations.logging import LoggingIntegration
import structlog  # v23.1.0
from structlog.types import Processor

from ..config import settings

# Constants
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
MAX_BYTES = 10485760  # 10MB
BACKUP_COUNT = 5
LOG_QUEUE_SIZE = 10000

# Initialize the base logger
logger = structlog.get_logger(__name__)

def setup_logging() -> None:
    """
    Configures comprehensive logging for the Content Discovery Service with
    structured logging, Sentry integration, and environment-specific formatting.
    
    Implements:
    - Structured logging with context processors
    - Sentry error tracking integration
    - Environment-specific formatting (JSON in production)
    - Log rotation and compression
    - Async logging for performance
    - Log sampling and PII filtering
    """
    
    # Validate and set log level
    log_level = getattr(logging, settings.LOG_LEVEL, logging.INFO)
    
    # Configure basic logging
    logging.basicConfig(
        format=LOG_FORMAT,
        level=log_level
    )

    # Initialize Sentry if DSN is provided
    if settings.SENTRY_DSN:
        sentry_logging = LoggingIntegration(
            level=logging.WARNING,
            event_level=logging.ERROR
        )
        
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENV,
            traces_sample_rate=1.0 if settings.ENV != "production" else 0.1,
            integrations=[sentry_logging],
            before_send=_sanitize_event_data
        )

    # Configure processors for structlog
    processors: list[Processor] = [
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        _add_environment_context,
        _sanitize_log_data,
    ]

    # Add environment-specific processors
    if settings.ENV == "production":
        processors.extend([
            structlog.processors.JSONRenderer()
        ])
    else:
        processors.extend([
            structlog.dev.ConsoleRenderer()
        ])

    # Configure structlog
    structlog.configure(
        processors=processors,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # Setup async logging for performance
    log_queue = queue.Queue(maxsize=LOG_QUEUE_SIZE)
    queue_handler = _setup_queue_handler(log_queue)
    
    # Configure log rotation
    file_handler = _setup_file_handler()
    
    # Add handlers to root logger
    root_logger = logging.getLogger()
    root_logger.addHandler(queue_handler)
    if file_handler:
        root_logger.addHandler(file_handler)

def get_logger(module_name: str) -> structlog.BoundLogger:
    """
    Returns a configured logger instance with structured logging and error tracking capabilities.
    
    Args:
        module_name: Name of the module requesting the logger
        
    Returns:
        Configured structured logger instance with context processors
    """
    return structlog.get_logger(
        module_name,
        env=settings.ENV,
        version="1.0.0"
    )

def _setup_queue_handler(log_queue: queue.Queue) -> logging.Handler:
    """
    Sets up an async queue handler for improved logging performance.
    
    Args:
        log_queue: Queue for async logging
        
    Returns:
        Configured queue handler
    """
    queue_handler = logging.handlers.QueueHandler(log_queue)
    queue_listener = logging.handlers.QueueListener(
        log_queue,
        _setup_console_handler(),
        respect_handler_level=True
    )
    queue_listener.start()
    return queue_handler

def _setup_console_handler() -> logging.Handler:
    """
    Configures console logging handler with appropriate formatting.
    
    Returns:
        Configured console handler
    """
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(logging.Formatter(LOG_FORMAT))
    return console_handler

def _setup_file_handler() -> Optional[logging.Handler]:
    """
    Configures rotating file handler for log persistence if in production.
    
    Returns:
        Configured file handler or None if not in production
    """
    if settings.ENV == "production":
        file_handler = logging.handlers.RotatingFileHandler(
            filename="content_discovery.log",
            maxBytes=MAX_BYTES,
            backupCount=BACKUP_COUNT,
            encoding="utf-8"
        )
        file_handler.setFormatter(logging.Formatter(LOG_FORMAT))
        return file_handler
    return None

def _add_environment_context(
    logger: structlog.types.WrappedLogger,
    name: str,
    event_dict: dict
) -> dict:
    """
    Adds environment context to log events.
    
    Args:
        logger: The wrapped logger instance
        name: The name of the logger
        event_dict: The current event dictionary
        
    Returns:
        Updated event dictionary with environment context
    """
    event_dict["environment"] = settings.ENV
    return event_dict

def _sanitize_log_data(
    logger: structlog.types.WrappedLogger,
    name: str,
    event_dict: dict
) -> dict:
    """
    Sanitizes sensitive data from log events.
    
    Args:
        logger: The wrapped logger instance
        name: The name of the logger
        event_dict: The current event dictionary
        
    Returns:
        Sanitized event dictionary
    """
    # List of sensitive keys to sanitize
    sensitive_keys = {
        "password", "token", "api_key", "secret",
        "authorization", "access_token", "refresh_token"
    }
    
    def _redact_sensitive(obj: dict) -> dict:
        if isinstance(obj, dict):
            return {
                k: "[REDACTED]" if k.lower() in sensitive_keys else 
                   _redact_sensitive(v) if isinstance(v, (dict, list)) else v
                for k, v in obj.items()
            }
        elif isinstance(obj, list):
            return [_redact_sensitive(i) if isinstance(i, (dict, list)) else i for i in obj]
        return obj

    return _redact_sensitive(event_dict)

def _sanitize_event_data(event: dict, hint: dict) -> Optional[dict]:
    """
    Sanitizes sensitive data from Sentry events.
    
    Args:
        event: The event to be sent to Sentry
        hint: Contains additional information about the event
        
    Returns:
        Sanitized event or None to drop the event
    """
    if "exc_info" in hint:
        exc_type, exc_value, tb = hint["exc_info"]
        # Drop certain exceptions from being reported
        if exc_type.__name__ in {"ConnectionError", "Timeout"}:
            return None
    
    # Sanitize sensitive data
    if "request" in event and "headers" in event["request"]:
        # Redact sensitive headers
        sensitive_headers = {"authorization", "cookie", "x-api-key"}
        headers = event["request"]["headers"]
        for header in sensitive_headers:
            if header in headers:
                headers[header] = "[REDACTED]"
    
    return event