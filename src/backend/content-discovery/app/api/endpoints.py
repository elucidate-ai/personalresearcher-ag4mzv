# External imports with versions specified for security and compatibility
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks  # ^0.100.0
from fastapi_limiter import RateLimiter  # ^0.1.5
from uuid import UUID  # built-in
from typing import List, Optional  # built-in
import logging  # built-in
from datetime import datetime
from opentelemetry import trace
from prometheus_client import Counter, Histogram

# Internal imports
from ..config import settings
from ..core.source_aggregator import SourceAggregator
from ..core.quality_analyzer import QualityAnalyzer
from ..schemas.content import ContentCreate, ContentResponse, ContentList

# Initialize logging
logger = logging.getLogger(__name__)

# Initialize tracing
tracer = trace.get_tracer(__name__)

# Initialize metrics
REQUEST_COUNTER = Counter(
    'content_discovery_requests_total',
    'Total content discovery requests',
    ['endpoint', 'status']
)
LATENCY_HISTOGRAM = Histogram(
    'content_discovery_request_duration_seconds',
    'Content discovery request duration'
)

# Initialize router with prefix and tags
router = APIRouter(prefix='/api/v1/content', tags=['content'])

# Initialize core services
source_aggregator = SourceAggregator(timeout=settings.REQUEST_TIMEOUT)
quality_analyzer = QualityAnalyzer(quality_threshold=settings.MIN_QUALITY_SCORE)

# Configure rate limiting
rate_limiter = RateLimiter(key_func=lambda: 'global', rate='100/minute')

@router.post('/', response_model=ContentList)
@rate_limiter
async def discover_content(
    topic_id: UUID,
    query: str,
    filters: Optional[dict] = None,
    background_tasks: BackgroundTasks = None
) -> ContentList:
    """
    Discovers and analyzes content for a given topic with comprehensive error handling
    and monitoring.

    Args:
        topic_id: UUID of the topic being researched
        query: Search query string
        filters: Optional filters for content discovery
        background_tasks: FastAPI background tasks handler

    Returns:
        ContentList: Paginated list of discovered and analyzed content

    Raises:
        HTTPException: If request fails or validation errors occur
    """
    request_start = datetime.utcnow()
    correlation_id = str(UUID())

    logger.info(
        "Starting content discovery",
        extra={
            "correlation_id": correlation_id,
            "topic_id": str(topic_id),
            "query": query
        }
    )

    try:
        # Input validation
        if not query or not query.strip():
            raise HTTPException(status_code=400, detail="Query cannot be empty")

        if len(query) > 200:
            raise HTTPException(status_code=400, detail="Query too long")

        # Discover content with timeout protection
        with LATENCY_HISTOGRAM.time():
            content_items = await source_aggregator.discover_content(
                topic_id=topic_id,
                query=query,
                filters=filters
            )

        # Apply quality threshold filtering
        quality_content = [
            item for item in content_items
            if item.quality_score >= settings.MIN_QUALITY_SCORE
        ]

        # Apply pagination
        page_size = min(
            filters.get('page_size', 20) if filters else 20,
            settings.MAX_CONTENT_ITEMS
        )
        page = filters.get('page', 1) if filters else 1
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size

        paginated_content = quality_content[start_idx:end_idx]

        # Schedule background processing if needed
        if background_tasks:
            background_tasks.add_task(
                process_content_background,
                content_items=paginated_content,
                correlation_id=correlation_id
            )

        # Record metrics
        REQUEST_COUNTER.labels(
            endpoint='discover_content',
            status='success'
        ).inc()

        # Log response
        logger.info(
            "Content discovery completed",
            extra={
                "correlation_id": correlation_id,
                "topic_id": str(topic_id),
                "total_items": len(quality_content),
                "returned_items": len(paginated_content),
                "duration": (datetime.utcnow() - request_start).total_seconds()
            }
        )

        return ContentList(
            items=[ContentResponse.from_orm(item) for item in paginated_content],
            total=len(quality_content),
            page=page,
            size=page_size
        )

    except Exception as e:
        REQUEST_COUNTER.labels(
            endpoint='discover_content',
            status='error'
        ).inc()

        logger.error(
            "Content discovery failed",
            extra={
                "correlation_id": correlation_id,
                "topic_id": str(topic_id),
                "error": str(e)
            },
            exc_info=True
        )

        raise HTTPException(
            status_code=500,
            detail="Content discovery failed"
        )

@router.get('/{content_id}', response_model=ContentResponse)
@rate_limiter
async def get_content(content_id: UUID) -> ContentResponse:
    """
    Retrieves specific content by ID with error handling and caching.

    Args:
        content_id: UUID of the content to retrieve

    Returns:
        ContentResponse: Content item details

    Raises:
        HTTPException: If content not found or other errors occur
    """
    logger.info(f"Retrieving content: {content_id}")

    try:
        # Attempt to retrieve content
        content = await source_aggregator.get_content_by_id(content_id)
        
        if not content:
            raise HTTPException(
                status_code=404,
                detail=f"Content not found: {content_id}"
            )

        REQUEST_COUNTER.labels(
            endpoint='get_content',
            status='success'
        ).inc()

        return ContentResponse.from_orm(content)

    except HTTPException:
        REQUEST_COUNTER.labels(
            endpoint='get_content',
            status='not_found'
        ).inc()
        raise

    except Exception as e:
        REQUEST_COUNTER.labels(
            endpoint='get_content',
            status='error'
        ).inc()

        logger.error(
            f"Error retrieving content: {content_id}",
            exc_info=True
        )
        
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve content"
        )

@router.get('/topic/{topic_id}', response_model=ContentList)
@rate_limiter
async def get_topic_content(
    topic_id: UUID,
    page: Optional[int] = 1,
    size: Optional[int] = 20,
    filters: Optional[dict] = None
) -> ContentList:
    """
    Retrieves all content for a topic with pagination and filtering.

    Args:
        topic_id: Topic UUID
        page: Page number (default: 1)
        size: Page size (default: 20)
        filters: Optional content filters

    Returns:
        ContentList: Paginated list of topic content

    Raises:
        HTTPException: If topic not found or other errors occur
    """
    logger.info(f"Retrieving content for topic: {topic_id}")

    try:
        # Validate pagination parameters
        if page < 1:
            raise HTTPException(
                status_code=400,
                detail="Page number must be >= 1"
            )

        if size < 1 or size > settings.MAX_CONTENT_ITEMS:
            raise HTTPException(
                status_code=400,
                detail=f"Page size must be between 1 and {settings.MAX_CONTENT_ITEMS}"
            )

        # Retrieve content with filters
        content_items = await source_aggregator.get_topic_content(
            topic_id=topic_id,
            filters=filters
        )

        # Apply quality threshold
        quality_content = [
            item for item in content_items
            if item.quality_score >= settings.MIN_QUALITY_SCORE
        ]

        # Apply pagination
        start_idx = (page - 1) * size
        end_idx = start_idx + size
        paginated_content = quality_content[start_idx:end_idx]

        REQUEST_COUNTER.labels(
            endpoint='get_topic_content',
            status='success'
        ).inc()

        return ContentList(
            items=[ContentResponse.from_orm(item) for item in paginated_content],
            total=len(quality_content),
            page=page,
            size=size
        )

    except Exception as e:
        REQUEST_COUNTER.labels(
            endpoint='get_topic_content',
            status='error'
        ).inc()

        logger.error(
            f"Error retrieving topic content: {topic_id}",
            exc_info=True
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve topic content"
        )

async def process_content_background(
    content_items: List[ContentResponse],
    correlation_id: str
) -> None:
    """
    Processes content items in the background for enhanced analysis.

    Args:
        content_items: List of content items to process
        correlation_id: Request correlation ID for tracking
    """
    logger.info(
        "Starting background content processing",
        extra={"correlation_id": correlation_id}
    )

    try:
        for item in content_items:
            # Perform additional analysis and enrichment
            await quality_analyzer.analyze_content(
                content=item,
                topic=item.title
            )

        logger.info(
            "Background content processing completed",
            extra={"correlation_id": correlation_id}
        )

    except Exception as e:
        logger.error(
            "Background content processing failed",
            extra={
                "correlation_id": correlation_id,
                "error": str(e)
            },
            exc_info=True
        )