"""
Initialization module for the Vector Service application.
Provides thread-safe initialization of configuration, database connections, gRPC server components,
health checks, and monitoring systems.

External Dependencies:
prometheus_client==0.17.1 - Metrics and monitoring
opentelemetry-api==1.20.0 - Distributed tracing
logging (built-in) - Application logging
threading (built-in) - Thread safety
atexit (built-in) - Cleanup handling
"""

import threading
import atexit
import logging
from typing import Tuple
from prometheus_client import start_http_server, Counter, Gauge
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode

from .config import Settings, load_settings
from .db.pinecone import PineconeClient
from .grpc.server import serve
from .utils.logger import setup_logging

# Thread safety mechanisms
_initialization_lock = threading.Lock()
_initialized = threading.Event()

# Global service components
settings: Settings = None
db_client: PineconeClient = None
logger = logging.getLogger(__name__)

# Prometheus metrics
INITIALIZATION_TIME = Gauge('vector_service_initialization_seconds', 
                          'Time taken to initialize the service')
HEALTH_STATUS = Gauge('vector_service_health_status', 
                     'Current health status of the service')
ERROR_COUNTER = Counter('vector_service_initialization_errors_total',
                       'Total initialization errors')

def initialize_app() -> Tuple[Settings, PineconeClient]:
    """
    Initialize the Vector Service application components with thread safety and health checks.
    
    Returns:
        Tuple[Settings, PineconeClient]: Initialized service components
        
    Raises:
        RuntimeError: If initialization fails
    """
    global settings, db_client, logger
    
    # Ensure thread-safe initialization
    with _initialization_lock:
        if _initialized.is_set():
            return settings, db_client
            
        try:
            with INITIALIZATION_TIME.time():
                # Load and validate settings
                settings = load_settings()
                
                # Configure logging with correlation IDs
                logger = setup_logging(settings)
                logger.info("Starting Vector Service initialization")
                
                # Initialize database client with retries
                db_client = PineconeClient(settings)
                
                # Verify database health and indexes
                health_status = await db_client.check_health()
                if health_status["status"] != "healthy":
                    raise RuntimeError(f"Database health check failed: {health_status}")
                
                # Configure metrics server
                metrics_port = settings.GRPC_PORT + 1
                start_http_server(metrics_port)
                logger.info(f"Metrics server started on port {metrics_port}")
                
                # Initialize OpenTelemetry tracing
                tracer = trace.get_tracer(__name__)
                with tracer.start_as_current_span("initialization") as span:
                    span.set_status(Status(StatusCode.OK))
                    
                # Set up health monitoring
                HEALTH_STATUS.set(1)  # 1 = healthy
                
                # Mark initialization as complete
                _initialized.set()
                logger.info("Vector Service initialization completed successfully")
                
                return settings, db_client
                
        except Exception as e:
            ERROR_COUNTER.inc()
            logger.error(f"Initialization failed: {str(e)}")
            HEALTH_STATUS.set(0)  # 0 = unhealthy
            raise RuntimeError(f"Failed to initialize Vector Service: {str(e)}")

@atexit.register
def cleanup() -> None:
    """
    Perform graceful cleanup of service resources.
    Ensures proper shutdown of connections and flushes of metrics/logs.
    """
    global db_client, logger
    
    try:
        logger.info("Starting Vector Service cleanup")
        
        # Close database connections
        if db_client:
            # Flush any pending operations
            db_client._index = None
            db_client._connection_pool.clear()
            
        # Flush metrics
        HEALTH_STATUS.set(0)
        
        # Flush logs
        for handler in logger.handlers:
            handler.flush()
            handler.close()
            
        logger.info("Vector Service cleanup completed")
        
    except Exception as e:
        logger.error(f"Cleanup failed: {str(e)}")

# Export thread-safe service components
__all__ = ['settings', 'db_client', 'initialize_app']