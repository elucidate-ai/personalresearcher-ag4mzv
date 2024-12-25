# External imports with versions specified for security and compatibility
from fastapi import FastAPI, Request  # ^0.100.0
from fastapi.middleware.cors import CORSMiddleware  # ^0.100.0
from fastapi.middleware.gzip import GZipMiddleware  # ^0.100.0
import sentry_sdk  # ^1.30.0
from prometheus_client import make_asgi_app, Counter, Histogram  # ^0.17.0
from opentelemetry import trace  # ^1.20.0
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentation
from circuitbreaker import circuit  # ^1.4.0
import logging
import asyncio
from typing import Dict, Any
import time

# Internal imports
from app.config import settings
from app.api.endpoints import router
from app.db.mongodb import MongoDBClient
from app.utils.logger import setup_logging, get_logger

# Initialize logger
logger = get_logger(__name__)

# Initialize metrics
REQUEST_COUNTER = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

RESPONSE_TIME = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint']
)

# Initialize tracer
tracer = trace.get_tracer(__name__)

# Initialize FastAPI app with production configuration
app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
    docs_url='/api/docs',
    redoc_url='/api/redoc',
    openapi_url='/api/openapi.json'
)

# Initialize database client
db_client = MongoDBClient()

async def configure_middleware() -> None:
    """Configures application middleware stack with security and monitoring."""
    
    # CORS middleware with security settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if settings.DEBUG else settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["*"],
        max_age=600
    )

    # Compression middleware
    app.add_middleware(
        GZipMiddleware,
        minimum_size=1000
    )

    # Request ID middleware
    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(time.time()))
        with tracer.start_as_current_span(
            "http_request",
            attributes={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path
            }
        ):
            response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            return response

    # Metrics middleware
    @app.middleware("http")
    async def monitor_requests(request: Request, call_next):
        start_time = time.time()
        method = request.method
        path = request.url.path

        try:
            response = await call_next(request)
            status = response.status_code
            duration = time.time() - start_time

            REQUEST_COUNTER.labels(
                method=method,
                endpoint=path,
                status=status
            ).inc()

            RESPONSE_TIME.labels(
                method=method,
                endpoint=path
            ).observe(duration)

            return response

        except Exception as e:
            REQUEST_COUNTER.labels(
                method=method,
                endpoint=path,
                status=500
            ).inc()
            raise

@app.on_event("startup")
async def startup() -> None:
    """Application startup handler with comprehensive initialization."""
    try:
        # Setup structured logging
        setup_logging()
        logger.info("Starting Content Discovery Service")

        # Configure Sentry
        if settings.SENTRY_DSN:
            sentry_sdk.init(
                dsn=settings.SENTRY_DSN,
                environment=settings.ENV,
                traces_sample_rate=1.0 if settings.DEBUG else 0.1
            )

        # Setup OpenTelemetry
        FastAPIInstrumentation.instrument_app(app)

        # Configure middleware
        await configure_middleware()

        # Connect to database
        for attempt in range(3):
            try:
                await db_client.connect()
                break
            except Exception as e:
                if attempt == 2:
                    logger.error("Failed to connect to database", exc_info=True)
                    raise
                await asyncio.sleep(2 ** attempt)

        # Include API router
        app.include_router(
            router,
            prefix=settings.API_PREFIX
        )

        # Mount metrics endpoint
        metrics_app = make_asgi_app()
        app.mount("/metrics", metrics_app)

        logger.info("Content Discovery Service started successfully")

    except Exception as e:
        logger.error("Service startup failed", exc_info=True)
        raise

@app.on_event("shutdown")
async def shutdown() -> None:
    """Application shutdown handler with graceful cleanup."""
    logger.info("Shutting down Content Discovery Service")
    
    try:
        # Close database connection
        await db_client.disconnect()
        
        # Clean up any remaining tasks
        tasks = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
        [task.cancel() for task in tasks]
        
        await asyncio.gather(*tasks, return_exceptions=True)
        
        logger.info("Service shutdown completed successfully")
        
    except Exception as e:
        logger.error("Error during shutdown", exc_info=True)
        raise

@app.get("/health")
@circuit(failure_threshold=5, recovery_timeout=60)
async def health_check() -> Dict[str, Any]:
    """Enhanced health check endpoint with comprehensive system status."""
    with tracer.start_as_current_span("health_check"):
        try:
            # Check database connection
            if not await db_client.connect():
                return {
                    "status": "unhealthy",
                    "database": "disconnected",
                    "timestamp": time.time()
                }

            # Basic health metrics
            return {
                "status": "healthy",
                "database": "connected",
                "version": "1.0.0",
                "environment": settings.ENV,
                "timestamp": time.time()
            }

        except Exception as e:
            logger.error("Health check failed", exc_info=True)
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": time.time()
            }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        workers=4,
        log_level=settings.LOG_LEVEL.lower()
    )