# External imports with versions specified for security and compatibility
from fastapi import FastAPI, APIRouter, Request, Response  # ^0.100.0
from fastapi.middleware.cors import CORSMiddleware  # ^0.100.0
from fastapi.responses import JSONResponse  # ^0.100.0
from fastapi_limiter import FastAPILimiter  # ^0.1.5
from prometheus_client import Counter, Histogram  # ^0.17.0
from opentelemetry import trace  # ^1.20.0
import logging
from typing import Callable
import time

# Internal imports
from .endpoints import router as content_router
from ..config import settings
from ..utils.logger import get_logger

# Initialize logging
logger = get_logger(__name__)

# Initialize metrics
REQUEST_COUNTER = Counter(
    'api_requests_total',
    'Total API requests',
    ['method', 'endpoint', 'status']
)

LATENCY_HISTOGRAM = Histogram(
    'api_request_duration_seconds',
    'API request duration',
    ['method', 'endpoint']
)

# Initialize tracer
tracer = trace.get_tracer(__name__)

def configure_router(base_router: APIRouter) -> APIRouter:
    """
    Configures the API router with comprehensive middleware, error handlers,
    and monitoring capabilities.

    Args:
        base_router: Base APIRouter instance to configure

    Returns:
        Configured APIRouter with all middleware and handlers attached
    """
    # Configure router prefix and tags
    router = APIRouter(
        prefix="/api/v1/content",
        tags=["content"]
    )

    # Add CORS middleware
    router.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"]
    )

    # Add request logging middleware
    @router.middleware("http")
    async def log_requests(request: Request, call_next: Callable) -> Response:
        """Logs request details and timing."""
        start_time = time.time()
        
        # Generate request ID for tracking
        request_id = str(request.headers.get("X-Request-ID", ""))
        
        logger.info(
            "Incoming request",
            extra={
                "request_id": request_id,
                "method": request.method,
                "url": str(request.url),
                "client_host": request.client.host if request.client else None
            }
        )

        try:
            response = await call_next(request)
            
            # Record metrics
            REQUEST_COUNTER.labels(
                method=request.method,
                endpoint=request.url.path,
                status=response.status_code
            ).inc()

            duration = time.time() - start_time
            LATENCY_HISTOGRAM.labels(
                method=request.method,
                endpoint=request.url.path
            ).observe(duration)

            logger.info(
                "Request completed",
                extra={
                    "request_id": request_id,
                    "status_code": response.status_code,
                    "duration": duration
                }
            )

            return response

        except Exception as e:
            logger.error(
                "Request failed",
                extra={
                    "request_id": request_id,
                    "error": str(e)
                },
                exc_info=True
            )
            
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error"}
            )

    # Add rate limiting
    @router.middleware("http")
    async def rate_limit(request: Request, call_next: Callable) -> Response:
        """Applies rate limiting to requests."""
        try:
            await FastAPILimiter.check(request)
            return await call_next(request)
        except Exception as e:
            logger.warning(
                "Rate limit exceeded",
                extra={
                    "client_host": request.client.host if request.client else None,
                    "error": str(e)
                }
            )
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests"}
            )

    # Include content router endpoints
    router.include_router(content_router)

    return router

# Initialize and configure the API router
api_router = configure_router(APIRouter())

# Export configured router
__all__ = ["api_router"]