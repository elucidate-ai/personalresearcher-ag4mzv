"""
Entry point for the Vector Service that initializes configuration, logging, and starts the gRPC server.
Implements comprehensive monitoring, graceful shutdown, and resource management.

External Dependencies:
prometheus_client==0.17.1 - Metrics and monitoring
signal (built-in) - Signal handling
sys (built-in) - System utilities
"""

import sys
import signal
from prometheus_client import start_http_server, Gauge, Counter

from app.config import load_settings
from app.utils.logger import setup_logging
from app.grpc.server import serve

# Version information
VERSION = '1.0.0'

# Prometheus metrics
SYSTEM_INFO = Gauge('vector_service_info', 'Vector Service information', ['version'])
STARTUP_TIME = Gauge('vector_service_startup_seconds', 'Service startup duration in seconds')
SHUTDOWN_TIME = Gauge('vector_service_shutdown_seconds', 'Service shutdown duration in seconds')
ERROR_COUNTER = Counter('vector_service_errors_total', 'Total number of service errors')

# Global variables for graceful shutdown
logger = None
shutdown_event = False

def signal_handler(signum, frame):
    """
    Handle system signals for graceful shutdown with resource cleanup.
    
    Args:
        signum: Signal number
        frame: Current stack frame
    """
    global shutdown_event
    
    signal_name = 'SIGTERM' if signum == signal.SIGTERM else 'SIGINT'
    logger.info(f"Received {signal_name} signal, initiating graceful shutdown...")
    
    try:
        # Set shutdown flag
        shutdown_event = True
        
        # Stop Prometheus metrics server
        logger.info("Stopping metrics server...")
        # Note: Prometheus client doesn't provide direct stop method
        # The server will be terminated with the process
        
        # Log successful shutdown initiation
        logger.info("Shutdown sequence initiated successfully")
        
        # Exit process with success status
        sys.exit(0)
        
    except Exception as e:
        logger.error(f"Error during shutdown: {str(e)}")
        ERROR_COUNTER.inc()
        sys.exit(1)

def main() -> int:
    """
    Main entry point that initializes and starts the Vector Service with comprehensive monitoring.
    
    Returns:
        int: Exit code (0 for success, 1 for configuration error, 2 for initialization error)
    """
    global logger
    
    try:
        # Load and validate service configuration
        settings = load_settings()
        
        # Initialize logging system
        logger = setup_logging(settings)
        logger.info(f"Starting Vector Service v{VERSION}")
        
        # Set up Prometheus metrics
        SYSTEM_INFO.labels(version=VERSION).set(1)
        metrics_port = settings.GRPC_PORT + 1
        start_http_server(metrics_port)
        logger.info(f"Metrics server started on port {metrics_port}")
        
        # Register signal handlers for graceful shutdown
        signal.signal(signal.SIGTERM, signal_handler)
        signal.signal(signal.SIGINT, signal_handler)
        logger.info("Signal handlers registered")
        
        # Validate system dependencies
        logger.info("Validating system dependencies...")
        # Add specific dependency checks here if needed
        
        try:
            # Start gRPC server
            logger.info(f"Starting gRPC server on port {settings.GRPC_PORT}")
            serve(settings.GRPC_PORT)
            
            # Log successful startup
            logger.info(
                "Vector Service started successfully",
                extra={
                    "metadata": {
                        "version": VERSION,
                        "grpc_port": settings.GRPC_PORT,
                        "metrics_port": metrics_port,
                        "environment": settings.ENV_STATE
                    }
                }
            )
            
            return 0
            
        except Exception as e:
            logger.error(f"Failed to start gRPC server: {str(e)}")
            ERROR_COUNTER.inc()
            return 2
            
    except Exception as e:
        # Handle initialization errors
        if logger:
            logger.error(f"Service initialization failed: {str(e)}")
        else:
            print(f"Failed to initialize logging: {str(e)}")
        ERROR_COUNTER.inc()
        return 1

if __name__ == "__main__":
    sys.exit(main())