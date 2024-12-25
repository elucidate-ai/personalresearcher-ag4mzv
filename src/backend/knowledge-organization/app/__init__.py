"""
Initialization module for the Knowledge Organization service.
Provides enterprise-grade FastAPI application setup with comprehensive monitoring,
structured logging, and health checks.

Version: 1.0.0
"""

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette_exporter import PrometheusMiddleware, handle_metrics
import structlog
import logging
import time
from typing import Callable
from prometheus_client import Counter, Histogram

from .config import settings
from .api.endpoints import router
from .utils.logger import logger, setup_logging, log_error

# Initialize metrics
REQUEST_COUNT = Counter(
    'knowledge_organization_requests_total',
    'Total number of requests processed',
    ['method', 'endpoint', 'status']
)

REQUEST_LATENCY = Histogram(
    'knowledge_organization_request_latency_seconds',
    'Request latency in seconds',
    ['method', 'endpoint']
)

class RequestMiddleware(BaseHTTPMiddleware):
    """Custom middleware for request tracking and correlation ID management."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        
        # Generate or extract correlation ID
        correlation_id = request.headers.get('X-Correlation-ID') or str(uuid.uuid4())
        structlog.contextvars.bind_contextvars(correlation_id=correlation_id)
        
        try:
            # Process request
            response = await call_next(request)
            
            # Record metrics
            duration = time.time() - start_time
            REQUEST_COUNT.labels(
                method=request.method,
                endpoint=request.url.path,
                status=response.status_code
            ).inc()
            REQUEST_LATENCY.labels(
                method=request.method,
                endpoint=request.url.path
            ).observe(duration)
            
            # Add correlation ID to response headers
            response.headers['X-Correlation-ID'] = correlation_id
            return response
            
        except Exception as e:
            log_error(e, {
                'correlation_id': correlation_id,
                'path': request.url.path,
                'method': request.method
            })
            return JSONResponse(
                status_code=500,
                content={'error': 'Internal server error'}
            )

def setup_monitoring(app: FastAPI) -> None:
    """Configure comprehensive monitoring and metrics collection."""
    
    # Add Prometheus middleware
    app.add_middleware(PrometheusMiddleware)
    app.add_route("/metrics", handle_metrics)
    
    # Add custom request tracking
    app.add_middleware(RequestMiddleware)
    
    # Add CORS middleware with security headers
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure appropriately for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Correlation-ID"]
    )

def create_app() -> FastAPI:
    """
    Create and configure FastAPI application with enterprise features.
    
    Returns:
        FastAPI: Configured application instance
    """
    # Initialize FastAPI with configuration
    app = FastAPI(
        title=settings.APP_NAME,
        debug=settings.DEBUG,
        docs_url='/api/docs',
        redoc_url='/api/redoc'
    )
    
    # Setup structured logging
    setup_logging()
    
    # Configure monitoring and middleware
    setup_monitoring(app)
    
    # Register API routes
    app.include_router(router)
    
    # Health check endpoint
    @app.get("/health")
    async def health_check():
        return {
            "status": "healthy",
            "service": settings.APP_NAME,
            "environment": settings.ENV
        }
    
    # Startup event handler
    @app.on_event("startup")
    async def startup_event():
        logger.info(
            "Starting Knowledge Organization service",
            extra={"environment": settings.ENV}
        )
    
    # Shutdown event handler
    @app.on_event("shutdown")
    async def shutdown_event():
        logger.info(
            "Shutting down Knowledge Organization service",
            extra={"environment": settings.ENV}
        )
    
    return app

# Initialize application instance
app = create_app()

# Export commonly used objects
__all__ = ['app', 'logger']