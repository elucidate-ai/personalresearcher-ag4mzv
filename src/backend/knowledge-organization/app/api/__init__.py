"""
API initialization module for Knowledge Organization service.
Configures comprehensive routing, security, monitoring, and error handling.

Version: 1.0.0
"""

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.security import OAuth2PasswordBearer
from prometheus_client import CollectorRegistry, generate_latest, CONTENT_TYPE_LATEST
from opentelemetry import trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
import time
from typing import Callable, Dict, Any
import uuid

from .endpoints import router as knowledge_router
from ..utils.logger import logger, set_correlation_id
from ..config import settings

# Initialize metrics registry
metrics_registry = CollectorRegistry()

# Initialize tracer
tracer = trace.get_tracer(__name__)

# Initialize OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def correlation_middleware(request: Request, call_next: Callable) -> Response:
    """
    Middleware to handle correlation ID for request tracing.
    """
    correlation_id = request.headers.get('X-Correlation-ID', str(uuid.uuid4()))
    set_correlation_id(correlation_id)
    
    response = await call_next(request)
    response.headers['X-Correlation-ID'] = correlation_id
    
    return response

async def logging_middleware(request: Request, call_next: Callable) -> Response:
    """
    Middleware for request/response logging with performance metrics.
    """
    start_time = time.time()
    
    logger.info(
        "Request started",
        extra={
            "correlation_id": logger.get_correlation_id(),
            "method": request.method,
            "url": str(request.url),
            "client_host": request.client.host if request.client else None
        }
    )
    
    response = await call_next(request)
    
    duration = time.time() - start_time
    status_code = response.status_code
    
    logger.info(
        "Request completed",
        extra={
            "correlation_id": logger.get_correlation_id(),
            "duration": duration,
            "status_code": status_code,
            "content_length": response.headers.get("content-length")
        }
    )
    
    return response

def configure_api() -> FastAPI:
    """
    Configure FastAPI application with comprehensive middleware and routes.
    
    Returns:
        FastAPI: Configured FastAPI application
    """
    app = FastAPI(
        title="Knowledge Organization Service",
        description="Enterprise-grade knowledge graph management API",
        version="1.0.0",
        docs_url="/api/docs" if settings.ENV != "production" else None
    )
    
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"]
    )
    
    # Add compression middleware
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    
    # Add correlation ID middleware
    app.middleware("http")(correlation_middleware)
    
    # Add logging middleware
    app.middleware("http")(logging_middleware)
    
    # Configure OpenTelemetry instrumentation
    FastAPIInstrumentor.instrument_app(app)
    
    # Health check endpoint
    @app.get("/health")
    async def health_check() -> Dict[str, Any]:
        return {
            "status": "healthy",
            "service": "knowledge-organization",
            "version": "1.0.0",
            "environment": settings.ENV
        }
    
    # Metrics endpoint
    @app.get("/metrics")
    async def metrics() -> Response:
        return Response(
            generate_latest(metrics_registry),
            media_type=CONTENT_TYPE_LATEST
        )
    
    # Include knowledge graph router
    app.include_router(
        knowledge_router,
        prefix="/api/v1/knowledge",
        tags=["knowledge-graph"]
    )
    
    return app

# Initialize FastAPI application
app = configure_api()

# Export commonly used instances
__all__ = [
    'app',
    'metrics_registry',
    'tracer'
]