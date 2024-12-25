# External imports with versions specified for security and compatibility
from celery import Celery  # ^5.3.0
from kombu import Queue, Exchange  # ^5.3.0
from typing import Dict, Any
import logging

# Internal imports
from ..config import settings
from .content_processor import ContentProcessor
from .source_aggregator import SourceAggregator

# Configure logging
logger = logging.getLogger(__name__)

# Initialize Celery application with robust configuration
app = Celery(
    'content-discovery',
    broker=settings.REDIS_URI,
    backend=settings.REDIS_URI,
    task_serializer='json',
    result_serializer='json',
    accept_content=['json'],
    timezone='UTC',
    enable_utc=True
)

# Configure task queues with dedicated exchanges
task_queues = {
    'content_processing': Queue(
        'content_processing',
        Exchange('content_discovery', type='direct'),
        routing_key='process'
    ),
    'content_discovery': Queue(
        'content_discovery',
        Exchange('content_discovery', type='direct'),
        routing_key='discover'
    )
}

# Celery configuration with performance and reliability settings
app.conf.update({
    # Queue Configuration
    'task_queues': list(task_queues.values()),
    'task_default_queue': 'content_processing',
    'task_default_exchange': 'content_discovery',
    'task_default_routing_key': 'process',
    
    # Task Execution Settings
    'task_time_limit': 600,  # 10 minute hard time limit
    'task_soft_time_limit': 300,  # 5 minute soft time limit
    'task_acks_late': True,  # Ensure task completion before acknowledgment
    'worker_prefetch_multiplier': 1,  # Prevent worker overload
    'worker_max_tasks_per_child': 1000,  # Prevent memory leaks
    
    # Retry Configuration
    'task_publish_retry': True,
    'task_publish_retry_policy': {
        'max_retries': 3,
        'interval_start': 1,
        'interval_step': 2,
        'interval_max': 10,
    },
    
    # Result Backend Settings
    'result_expires': 3600,  # Results expire after 1 hour
    'result_persistent': True,  # Persist results in Redis
    
    # Performance Optimization
    'worker_pool': 'prefork',
    'worker_concurrency': 8,  # Adjust based on CPU cores
    'task_compression': 'gzip',
    
    # Monitoring and Logging
    'worker_send_task_events': True,
    'task_send_sent_event': True,
    'task_track_started': True,
    'task_store_errors_even_if_ignored': True
})

@app.task(
    name='content_discovery.process_content',
    queue='content_processing',
    bind=True,
    max_retries=3,
    soft_time_limit=30,
    time_limit=60,
    acks_late=True,
    retry_backoff=True
)
def process_content_task(self, content_item: Dict[str, Any]) -> Dict[str, Any]:
    """
    Processes individual content items with quality assessment and metadata enrichment.

    Args:
        content_item: Dictionary containing content data to process

    Returns:
        Dict containing processed content with quality score and metadata

    Raises:
        Exception: If content processing fails after retries
    """
    logger.info(
        "Processing content item",
        extra={"content_id": content_item.get("id")}
    )
    
    try:
        # Initialize content processor with configuration
        processor = ContentProcessor(
            quality_threshold=0.9,
            max_parallel_tasks=4
        )
        
        # Process content through quality pipeline
        processed_content = processor.process_content(content_item)
        
        logger.info(
            "Content processing completed",
            extra={
                "content_id": content_item.get("id"),
                "quality_score": processed_content.get("quality_score")
            }
        )
        
        return processed_content
        
    except Exception as e:
        logger.error(
            "Content processing failed",
            extra={
                "content_id": content_item.get("id"),
                "error": str(e),
                "retry_count": self.request.retries
            }
        )
        raise self.retry(exc=e, countdown=2 ** self.request.retries)

@app.task(
    name='content_discovery.aggregate_content',
    queue='content_discovery',
    bind=True,
    max_retries=3,
    soft_time_limit=300,
    time_limit=600,
    acks_late=True,
    retry_backoff=True
)
def aggregate_content_task(
    self,
    topic: str,
    topic_id: str,
    filters: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    Discovers and aggregates content from multiple sources with filtering and ranking.

    Args:
        topic: Search topic string
        topic_id: UUID of the topic
        filters: Content discovery filters

    Returns:
        List of discovered and filtered content items

    Raises:
        Exception: If content aggregation fails after retries
    """
    logger.info(
        "Starting content aggregation",
        extra={
            "topic": topic,
            "topic_id": topic_id
        }
    )
    
    try:
        # Initialize source aggregator
        aggregator = SourceAggregator({
            "max_videos": 20,
            "max_podcasts": 20,
            "max_books": 20
        })
        
        # Discover and aggregate content
        content_items = aggregator.aggregate_content(
            topic=topic,
            topic_id=topic_id,
            filters=filters
        )
        
        logger.info(
            "Content aggregation completed",
            extra={
                "topic_id": topic_id,
                "items_found": len(content_items)
            }
        )
        
        return content_items
        
    except Exception as e:
        logger.error(
            "Content aggregation failed",
            extra={
                "topic": topic,
                "topic_id": topic_id,
                "error": str(e),
                "retry_count": self.request.retries
            }
        )
        raise self.retry(exc=e, countdown=2 ** self.request.retries)

# Register periodic tasks if needed
@app.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    """Configure periodic tasks for content updates and maintenance."""
    # Add periodic tasks here if required
    pass