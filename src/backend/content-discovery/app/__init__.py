"""
Content Discovery Service initialization module.
Configures FastAPI application with middleware, error tracking, and monitoring.

Version: 1.0.0
"""

# External imports with versions specified for security and compatibility
from fastapi import FastAPI  # ^0.100.0
from fastapi.middleware.cors import CORSMiddleware  # ^0.100.0
import sentry_sdk  # ^1.30.0
from sentry_sdk.integrations.asgi import SentryAsgiMiddleware  # ^1.30.0
from prometheus_client import make_asgi_app  # ^0.17.0
import logging
from typing import Optional

# Internal imports
from .config import settings
from .api import router
from .core import app as celery_app

# Initialize package version
__version__ = "1.0.0"

# Configure logging
logger = logging.getLogger(__name__)

def init_app() -> FastAPI:
    """
    Initializes and configures the FastAPI application with all required components
    and middleware for production deployment.

    Returns:
        FastAPI: Configured FastAPI application instance
    """
    # Create FastAPI instance with OpenAPI documentation
    app = FastAPI(
        title="Content Discovery Service",
        description="AI-powered content discovery and curation system",
        version=__version__,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json"
    )

    # Configure Sentry for error tracking if DSN is provided
    if settings.SENTRY_DSN:
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENV,
            traces_sample_rate=1.0 if settings.ENV != "production" else 0.1,
            enable_tracing=True,
            attach_stacktrace=True,
            send_default_pii=False,
            before_send=_sanitize_error_event
        )
        app.add_middleware(SentryAsgiMiddleware)

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"]
    )

    # Add Prometheus metrics middleware
    metrics_app = make_asgi_app()
    app.mount("/metrics", metrics_app)

    # Include API router
    app.include_router(
        router,
        prefix=settings.API_PREFIX
    )

    # Register startup event handler
    @app.on_event("startup")
    async def startup_event():
        """Performs necessary startup initialization."""
        logger.info(
            "Starting Content Discovery Service",
            extra={
                "version": __version__,
                "environment": settings.ENV
            }
        )

    # Register shutdown event handler
    @app.on_event("shutdown")
    async def shutdown_event():
        """Performs cleanup on shutdown."""
        logger.info("Shutting down Content Discovery Service")

    # Register health check endpoint
    @app.get("/health")
    async def health_check():
        """Basic health check endpoint."""
        return {
            "status": "healthy",
            "version": __version__,
            "environment": settings.ENV
        }

    return app

def _sanitize_error_event(event: dict, hint: Optional[dict] = None) -> dict:
    """
    Sanitizes sensitive data from error events before sending to Sentry.

    Args:
        event: The error event to sanitize
        hint: Additional context about the event

    Returns:
        dict: Sanitized error event
    """
    if "request" in event and "headers" in event["request"]:
        # Remove sensitive headers
        sensitive_headers = {"authorization", "cookie", "x-api-key"}
        headers = event["request"]["headers"]
        for header in sensitive_headers:
            if header in headers:
                headers[header] = "[REDACTED]"

    return event

# Initialize FastAPI application
app = init_app()

# Export Celery application
celery = celery_app

# Define package exports
__all__ = ["app", "celery", "__version__"]