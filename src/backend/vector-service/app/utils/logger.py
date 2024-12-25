"""
Centralized logging utility for the Vector Service.
Provides structured logging with correlation IDs, performance monitoring, and secure log management.

External Dependencies:
logging (built-in)
json-logging==1.3.0
sentry-sdk==1.32.0
asyncio (built-in)
"""

import logging
import json_logging
import sentry_sdk
import asyncio
from typing import Dict, Optional
from datetime import datetime
from functools import partial
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.integrations.asyncio import AsyncioIntegration

from ..config import Settings

# Initialize global logger
logger = logging.getLogger('vector-service')

class SecureJSONFormatter(logging.Formatter):
    """Custom JSON formatter with PII masking and security features."""
    
    PII_FIELDS = ['email', 'ip_address', 'user_id', 'password']
    MASK_PATTERN = '****'
    
    def format(self, record: logging.LogRecord) -> str:
        """
        Format log record with PII masking and enhanced metadata.
        
        Args:
            record (logging.LogRecord): Log record to format
            
        Returns:
            str: Formatted JSON log entry
        """
        log_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'service': 'vector-service',
            'level': record.levelname,
            'correlation_id': getattr(record, 'correlation_id', None),
            'message': record.getMessage(),
            'logger': record.name,
            'module': record.module,
            'line_number': record.lineno
        }
        
        # Add exception info if present
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)
            
        # Add custom metadata if present
        metadata = getattr(record, 'metadata', {})
        if metadata:
            # Mask PII in metadata
            masked_metadata = self._mask_pii(metadata)
            log_data['metadata'] = masked_metadata
            
        # Add performance metrics if present
        metrics = getattr(record, 'performance_metrics', None)
        if metrics:
            log_data['performance_metrics'] = metrics
            
        return json.dumps(log_data)
    
    def _mask_pii(self, data: Dict) -> Dict:
        """Mask PII fields in dictionary."""
        masked_data = data.copy()
        for key, value in masked_data.items():
            if key.lower() in self.PII_FIELDS:
                masked_data[key] = self.MASK_PATTERN
            elif isinstance(value, dict):
                masked_data[key] = self._mask_pii(value)
        return masked_data

class AsyncHandler(logging.Handler):
    """Asynchronous logging handler for non-blocking operations."""
    
    def __init__(self, capacity: int = 1000, flush_interval: int = 5):
        """
        Initialize async handler with buffering.
        
        Args:
            capacity (int): Maximum buffer size
            flush_interval (int): Flush interval in seconds
        """
        super().__init__()
        self.queue = asyncio.Queue(maxsize=capacity)
        self.flush_interval = flush_interval
        self.buffer = []
        self.loop = None
        
    async def flush_loop(self):
        """Periodic flush of buffered logs."""
        while True:
            await asyncio.sleep(self.flush_interval)
            if self.buffer:
                await self._flush_buffer()
                
    async def _flush_buffer(self):
        """Flush buffered logs to output."""
        if self.buffer:
            try:
                # Process buffered records
                records = self.buffer[:]
                self.buffer.clear()
                
                for record in records:
                    # Actual log emission logic here
                    print(self.format(record))  # Replace with actual output logic
            except Exception as e:
                # Fallback to synchronous logging on error
                logger.error(f"Async logging failed: {str(e)}")

def setup_logging(settings: Settings) -> logging.Logger:
    """
    Configure and initialize the logging system with monitoring integration.
    
    Args:
        settings (Settings): Application settings instance
        
    Returns:
        logging.Logger: Configured logger instance
    """
    # Initialize JSON logging
    json_logging.init_non_web(enable_json=True)
    
    # Configure Sentry integration
    sentry_logging = LoggingIntegration(
        level=logging.ERROR,
        event_level=logging.ERROR
    )
    
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENV_STATE,
        traces_sample_rate=1.0 if settings.ENV_STATE == 'development' else 0.2,
        integrations=[
            sentry_logging,
            AsyncioIntegration()
        ],
        attach_stacktrace=True,
        max_breadcrumbs=50
    )
    
    # Set log level from settings
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    logger.setLevel(log_level)
    
    # Configure console handler with secure JSON formatter
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(SecureJSONFormatter())
    logger.addHandler(console_handler)
    
    # Configure async handler for non-critical logs
    async_handler = AsyncHandler()
    async_handler.setFormatter(SecureJSONFormatter())
    async_handler.setLevel(logging.DEBUG)
    logger.addHandler(async_handler)
    
    # Start async handler flush loop
    loop = asyncio.get_event_loop()
    loop.create_task(async_handler.flush_loop())
    
    return logger

def log_error(logger: logging.Logger, error: Exception, correlation_id: str, metadata: Optional[Dict] = None):
    """
    Enhanced error logging with comprehensive context capture.
    
    Args:
        logger (logging.Logger): Logger instance
        error (Exception): Error to log
        correlation_id (str): Request correlation ID
        metadata (Optional[Dict]): Additional context metadata
    """
    error_context = {
        'error_type': type(error).__name__,
        'error_message': str(error),
        'correlation_id': correlation_id,
        'metadata': metadata or {}
    }
    
    # Add stack trace if available
    if hasattr(error, '__traceback__'):
        import traceback
        error_context['stack_trace'] = traceback.format_tb(error.__traceback__)
    
    # Log error with enhanced context
    logger.error(
        f"Error occurred: {str(error)}",
        extra={
            'correlation_id': correlation_id,
            'metadata': error_context
        },
        exc_info=True
    )
    
    # Capture in Sentry with full context
    sentry_sdk.capture_exception(
        error,
        extras=error_context
    )

# Export configured logger instance
__all__ = ['setup_logging', 'log_error', 'logger']