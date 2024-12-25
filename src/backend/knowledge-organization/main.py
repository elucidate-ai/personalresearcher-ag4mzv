"""
Main application entry point for the Knowledge Organization service.
Implements FastAPI application with comprehensive production features including
monitoring, security, and error handling.

Version: 1.0.0
"""

import uvicorn  # uvicorn v0.24.0
from fastapi import FastAPI, Request, HTTPException  # fastapi v0.104.0
from fastapi.middleware.cors import CORSMiddleware  # fastapi v0.104.0
from fastapi.middleware.gzip import GZipMiddleware  # fastapi v0.104.0
from prometheus_fastapi_instrumentator import Instrumentator  # prometheus-fastapi-instrumentator v6.1.0
import sentry_sdk  # sentry-sdk v1.32.0
from datetime import datetime, timezone
import json
import asyncio
from typing import Dict, Any

from app.config import settings
from app.api.endpoints import router
from app.utils.logger import logger, log_error
from app.db.neo4j import Neo4jConnection

# Initialize FastAPI application with production configuration
app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

def configure_middleware(app: FastAPI) -> None:
    """
    Configure FastAPI middleware components with security and performance features.
    """
    # CORS middleware with environment-specific configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"]
    )

    # GZip compression for response optimization
    app.add_middleware(
        GZipMiddleware,
        minimum_size=1000  # Only compress responses larger than 1KB
    )

    # Request correlation ID middleware
    @app.middleware("http")
    async def add_correlation_id(request: Request, call_next):
        correlation_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.correlation_id = correlation_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = correlation_id
        return response

    # Security headers middleware
    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    # Request validation middleware
    @app.middleware("http")
    async def validate_request(request: Request, call_next):
        if request.method in ["POST", "PUT", "PATCH"]:
            content_type = request.headers.get("Content-Type", "")
            if not content_type.startswith("application/json"):
                raise HTTPException(
                    status_code=415,
                    detail="Content-Type must be application/json"
                )
        return await call_next(request)

def configure_routes(app: FastAPI) -> None:
    """
    Register API routes and monitoring endpoints.
    """
    # Include knowledge graph API router
    app.include_router(router, prefix="/api/v1")

    # Health check endpoint
    @app.get("/health")
    async def health_check() -> Dict[str, Any]:
        """Comprehensive health check endpoint."""
        try:
            # Check Neo4j connection
            db = Neo4jConnection()
            await db.execute_async_query("MATCH (n) RETURN count(n) LIMIT 1")

            return {
                "status": "healthy",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "version": settings.APP_VERSION,
                "environment": settings.ENV,
                "database": "connected"
            }
        except Exception as e:
            log_error(e, {"operation": "health_check"})
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

    # Readiness probe endpoint
    @app.get("/ready")
    async def readiness_probe() -> Dict[str, str]:
        """Kubernetes readiness probe endpoint."""
        try:
            # Verify database connection
            db = Neo4jConnection()
            await db.execute_async_query("RETURN 1")
            return {"status": "ready"}
        except Exception as e:
            log_error(e, {"operation": "readiness_probe"})
            raise HTTPException(status_code=503, detail="Service not ready")

@app.on_event("startup")
async def startup_event() -> None:
    """
    Handle application startup tasks and initialization.
    """
    try:
        # Initialize Sentry monitoring
        if settings.SENTRY_DSN:
            sentry_sdk.init(
                dsn=settings.SENTRY_DSN,
                environment=settings.ENV,
                traces_sample_rate=0.1
            )

        # Initialize Prometheus metrics
        Instrumentator().instrument(app).expose(app, endpoint="/metrics")

        # Initialize database connection
        db = Neo4jConnection()
        await db.connect()

        logger.info(
            "Application started successfully",
            extra={
                "environment": settings.ENV,
                "version": settings.APP_VERSION
            }
        )
    except Exception as e:
        log_error(e, {"operation": "startup"})
        raise

@app.on_event("shutdown")
async def shutdown_event() -> None:
    """
    Handle graceful application shutdown.
    """
    try:
        # Close database connections
        db = Neo4jConnection()
        await db.close()

        logger.info("Application shutdown completed")
    except Exception as e:
        log_error(e, {"operation": "shutdown"})
        raise

def main() -> None:
    """
    Application entry point with production configuration.
    """
    # Configure application components
    configure_middleware(app)
    configure_routes(app)

    # Start application server
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        workers=4,
        loop="uvloop",
        http="httptools",
        log_level=settings.LOG_LEVEL.lower(),
        access_log=True,
        proxy_headers=True,
        forwarded_allow_ips="*"
    )

if __name__ == "__main__":
    main()