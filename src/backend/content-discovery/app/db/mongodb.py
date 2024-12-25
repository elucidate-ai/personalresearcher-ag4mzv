# External imports with versions specified for security and compatibility
import motor.motor_asyncio  # v3.3.0
import pymongo  # v4.6.0
from pymongo.errors import (
    ConnectionFailure, 
    OperationFailure, 
    ServerSelectionTimeoutError,
    WriteError
)
import logging
from typing import Dict, Optional, Any
import asyncio
from datetime import datetime

# Internal imports
from ..config import settings

# Configure logging
logger = logging.getLogger(__name__)

# Constants for retry and timeout configuration
RETRY_ATTEMPTS = 3
OPERATION_TIMEOUT = 30  # seconds

class MongoDBClient:
    """
    Secure and scalable asynchronous MongoDB client implementation with comprehensive
    error handling, connection pooling, and sharding support.
    """

    def __init__(self, connection_options: Optional[Dict[str, Any]] = None):
        """
        Initialize MongoDB client with enhanced security and performance options.

        Args:
            connection_options: Optional custom connection parameters
        """
        self._client: Optional[motor.motor_asyncio.AsyncIOMotorClient] = None
        self._db: Optional[motor.motor_asyncio.AsyncIOMotorDatabase] = None
        self._connected: bool = False
        self._connection_options = connection_options or {}
        
        # Merge with default options ensuring security and performance
        self._connection_options.update({
            "retryWrites": True,
            "w": "majority",
            "journal": True,
            "maxPoolSize": 100,
            "minPoolSize": 10,
            "maxIdleTimeMS": 50000,
            "serverSelectionTimeoutMS": 5000,
            "connectTimeoutMS": 5000
        })

    async def connect(self) -> bool:
        """
        Establishes secure MongoDB connection with SSL/TLS and connection pooling.

        Returns:
            bool: Connection success status
        """
        try:
            # Get MongoDB settings with SSL/TLS configuration
            mongo_settings = settings.get_mongodb_settings()
            self._connection_options.update(mongo_settings)

            # Create motor client with enhanced security
            self._client = motor.motor_asyncio.AsyncIOMotorClient(
                mongo_settings["host"],
                **self._connection_options
            )

            # Initialize database with sharding support
            self._db = self._client[mongo_settings["db"]]

            # Verify connection with server info check
            await self._client.server_info()
            self._connected = True

            logger.info(
                "Successfully connected to MongoDB cluster",
                extra={"database": mongo_settings["db"]}
            )
            return True

        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(
                "Failed to connect to MongoDB",
                extra={"error": str(e), "host": mongo_settings["host"]}
            )
            self._connected = False
            return False

    async def disconnect(self) -> None:
        """
        Safely closes MongoDB connection and cleans up resources.
        """
        if self._client:
            try:
                logger.info("Closing MongoDB connection...")
                await asyncio.wait_for(
                    self._client.close(), 
                    timeout=5.0
                )
            except asyncio.TimeoutError:
                logger.warning("MongoDB disconnect timeout - forcing close")
            finally:
                self._client = None
                self._db = None
                self._connected = False
                logger.info("MongoDB connection closed")

    async def insert_one(self, collection_name: str, document: Dict[str, Any]) -> Dict[str, Any]:
        """
        Securely inserts single document with retry support.

        Args:
            collection_name: Target collection name
            document: Document to insert

        Returns:
            Dict containing inserted document with _id

        Raises:
            OperationFailure: If insert operation fails
            ConnectionFailure: If database connection is lost
        """
        if not self._connected:
            raise ConnectionFailure("Not connected to MongoDB")

        # Add metadata fields
        document.update({
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })

        for attempt in range(RETRY_ATTEMPTS):
            try:
                result = await asyncio.wait_for(
                    self._db[collection_name].insert_one(document),
                    timeout=OPERATION_TIMEOUT
                )
                document["_id"] = result.inserted_id
                return document

            except (OperationFailure, WriteError) as e:
                if attempt == RETRY_ATTEMPTS - 1:
                    logger.error(
                        "Failed to insert document after retries",
                        extra={
                            "collection": collection_name,
                            "error": str(e),
                            "attempt": attempt + 1
                        }
                    )
                    raise
                await asyncio.sleep(2 ** attempt)  # Exponential backoff

    async def find_one(
        self, 
        collection_name: str, 
        query: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Finds single document with timeout and error handling.

        Args:
            collection_name: Target collection name
            query: Search query parameters

        Returns:
            Found document or None if not found

        Raises:
            OperationFailure: If query operation fails
            ConnectionFailure: If database connection is lost
        """
        if not self._connected:
            raise ConnectionFailure("Not connected to MongoDB")

        try:
            result = await asyncio.wait_for(
                self._db[collection_name].find_one(query),
                timeout=OPERATION_TIMEOUT
            )
            return result

        except OperationFailure as e:
            logger.error(
                "Failed to execute find_one query",
                extra={
                    "collection": collection_name,
                    "query": query,
                    "error": str(e)
                }
            )
            raise

    async def update_one(
        self, 
        collection_name: str, 
        query: Dict[str, Any], 
        update: Dict[str, Any]
    ) -> bool:
        """
        Updates single document with write concern.

        Args:
            collection_name: Target collection name
            query: Search criteria for document to update
            update: Update operations to apply

        Returns:
            bool indicating update success

        Raises:
            OperationFailure: If update operation fails
            ConnectionFailure: If database connection is lost
        """
        if not self._connected:
            raise ConnectionFailure("Not connected to MongoDB")

        # Add updated_at timestamp
        if "$set" in update:
            update["$set"]["updated_at"] = datetime.utcnow()
        else:
            update["$set"] = {"updated_at": datetime.utcnow()}

        for attempt in range(RETRY_ATTEMPTS):
            try:
                result = await asyncio.wait_for(
                    self._db[collection_name].update_one(query, update),
                    timeout=OPERATION_TIMEOUT
                )
                return result.modified_count > 0

            except (OperationFailure, WriteError) as e:
                if attempt == RETRY_ATTEMPTS - 1:
                    logger.error(
                        "Failed to update document after retries",
                        extra={
                            "collection": collection_name,
                            "query": query,
                            "error": str(e),
                            "attempt": attempt + 1
                        }
                    )
                    raise
                await asyncio.sleep(2 ** attempt)  # Exponential backoff

    async def delete_one(
        self, 
        collection_name: str, 
        query: Dict[str, Any]
    ) -> bool:
        """
        Safely deletes single document with confirmation.

        Args:
            collection_name: Target collection name
            query: Criteria for document to delete

        Returns:
            bool indicating deletion success

        Raises:
            OperationFailure: If delete operation fails
            ConnectionFailure: If database connection is lost
        """
        if not self._connected:
            raise ConnectionFailure("Not connected to MongoDB")

        try:
            result = await asyncio.wait_for(
                self._db[collection_name].delete_one(query),
                timeout=OPERATION_TIMEOUT
            )
            return result.deleted_count > 0

        except OperationFailure as e:
            logger.error(
                "Failed to delete document",
                extra={
                    "collection": collection_name,
                    "query": query,
                    "error": str(e)
                }
            )
            raise