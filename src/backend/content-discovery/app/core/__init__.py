"""
Core module for content discovery and processing functionality.
Provides high-performance, production-ready implementations for content discovery,
quality analysis, and processing with comprehensive error handling and monitoring.

Version: 1.0.0
"""

# Internal imports with explicit member imports
from .celery_app import (
    app,
    process_content_task,
    aggregate_content_task
)
from .quality_analyzer import QualityAnalyzer
from .source_aggregator import SourceAggregator
from .content_processor import ContentProcessor

# Define public API
__all__ = [
    'app',
    'QualityAnalyzer',
    'SourceAggregator',
    'ContentProcessor',
    'process_content_task',
    'aggregate_content_task'
]

# Module metadata
__version__ = '1.0.0'
__author__ = 'Content Discovery Team'
__description__ = 'Enterprise-grade content discovery and processing module'

# Module-level constants
DEFAULT_QUALITY_THRESHOLD = 0.9  # 90% quality threshold as per requirements
MAX_PROCESSING_TIME = 5  # 5 seconds per content item as per requirements
SYSTEM_AVAILABILITY = 0.999  # 99.9% uptime requirement

# Module initialization and validation
def _validate_dependencies():
    """
    Validates that all required dependencies and configurations are available.
    Raises RuntimeError if critical dependencies are missing.
    """
    required_components = [
        (app, "Celery application"),
        (QualityAnalyzer, "Quality analysis component"),
        (SourceAggregator, "Content aggregation component"),
        (ContentProcessor, "Content processing component")
    ]
    
    for component, name in required_components:
        if not component:
            raise RuntimeError(f"Critical component not available: {name}")

def _configure_performance_monitoring():
    """
    Configures performance monitoring and metrics collection for the core module.
    """
    # Performance monitoring is handled by the individual components
    # This hook is available for future enhancements
    pass

def _setup_error_handling():
    """
    Configures error handling and reporting for the core module.
    """
    # Error handling is implemented in individual components
    # This hook is available for future enhancements
    pass

# Initialize module
try:
    _validate_dependencies()
    _configure_performance_monitoring()
    _setup_error_handling()
except Exception as e:
    raise RuntimeError(f"Failed to initialize content discovery core module: {str(e)}")

# Module documentation
__doc__ = """
Content Discovery Core Module
============================

A high-performance, production-ready module for content discovery and processing
that implements the following key requirements:

1. Content Discovery Engine
   - Multi-source content aggregation
   - Quality assessment and ranking
   - Resource categorization

2. Performance Requirements
   - Processing speed: < 5 seconds per content item
   - Content relevance: 90% threshold
   - System availability: 99.9% uptime

Key Components:
--------------
- QualityAnalyzer: Content quality assessment and scoring
- SourceAggregator: Multi-source content discovery
- ContentProcessor: Content processing and enrichment
- Celery Tasks: Asynchronous processing capabilities

Usage:
------
from app.core import QualityAnalyzer, SourceAggregator, ContentProcessor
from app.core import process_content_task, aggregate_content_task

# Initialize components
quality_analyzer = QualityAnalyzer(quality_threshold=0.9)
source_aggregator = SourceAggregator(config={})
content_processor = ContentProcessor()

# Process content asynchronously
task = process_content_task.delay(content_item)
result = task.get()

# Aggregate content from multiple sources
task = aggregate_content_task.delay(topic="machine learning")
results = task.get()
"""