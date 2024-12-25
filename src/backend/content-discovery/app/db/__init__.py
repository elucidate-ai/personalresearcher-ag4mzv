"""
Database package initializer providing a singleton MongoDB client instance with 
comprehensive connection management, monitoring, and controlled access to database operations.

Version: 1.0.0
"""

# External imports with version specified for security
import logging  # Standard library
import atexit
import asyncio
from typing import Optional

# Internal imports
from .mongodb import MongoDBClient

# Configure package logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Initialize singleton database client
db_client = MongoDBClient()

# Package version and exports
__version__ = "1.0.0"
__all__ = ["db_client"]

async def initialize_db() -> bool:
    """
    Initializes the database client with proper configuration and health checks.
    Ensures proper connection pool setup and monitoring.
    
    Returns:
        bool: True if initialization successful, False otherwise
    """
    try:
        logger.info("Initializing database connection...")
        
        # Attempt database connection
        connection_success = await db_client.connect()
        if not connection_success:
            logger.error("Failed to establish database connection")
            return False
            
        # Verify connection health
        if not await db_client.health_check():
            logger.error("Database health check failed")
            await db_client.disconnect()
            return False
            
        # Get and log connection statistics
        stats = await db_client.get_connection_stats()
        logger.info(
            "Database initialized successfully",
            extra={
                "pool_size": stats.get("pool_size"),
                "active_connections": stats.get("active_connections"),
                "available_connections": stats.get("available_connections")
            }
        )
        
        return True
        
    except Exception as e:
        logger.error(
            "Database initialization failed",
            extra={"error": str(e)}
        )
        return False

@atexit.register
async def cleanup_db() -> None:
    """
    Performs clean shutdown of database connections and resources.
    Ensures proper cleanup of connection pools and monitoring.
    Registered with atexit to guarantee execution.
    """
    try:
        logger.info("Initiating database cleanup...")
        
        # Close database connection
        await db_client.disconnect()
        
        # Allow time for cleanup operations
        await asyncio.sleep(1)
        
        logger.info("Database cleanup completed successfully")
        
    except Exception as e:
        logger.error(
            "Database cleanup failed",
            extra={"error": str(e)}
        )
    finally:
        # Force event loop closure
        try:
            loop = asyncio.get_event_loop()
            if not loop.is_closed():
                loop.close()
        except Exception:
            pass

# Initialize database on module import
if not asyncio.get_event_loop().is_closed():
    asyncio.get_event_loop().run_until_complete(initialize_db())