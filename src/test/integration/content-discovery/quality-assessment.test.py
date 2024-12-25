"""
Integration tests for content quality assessment functionality.
Validates quality scoring, relevance thresholds, and performance requirements.

Version: 1.0.0
"""

import pytest
import asyncio
import time
from typing import Dict, List

from ../../utils.python.test_helpers import TestBase
from ../../../backend/content-discovery/app/core/quality_analyzer import QualityAnalyzer
from ../../fixtures.content import mockContentItems

# Constants
QUALITY_THRESHOLD = 0.9
PROCESSING_THRESHOLD_SECONDS = 5.0
TEST_TOPICS = ['machine_learning', 'quantum_computing', 'data_science']
CONTENT_TYPES = ['article', 'video', 'podcast', 'book']

@pytest.mark.asyncio
class TestQualityAssessment(TestBase):
    """Integration test suite for content quality assessment functionality."""

    def __init__(self):
        """Initialize test suite with quality analyzer and test data."""
        super().__init__()
        self._quality_analyzer = QualityAnalyzer(quality_threshold=QUALITY_THRESHOLD)
        self._test_content = {}
        self._start_time = 0.0
        self._processing_threshold = PROCESSING_THRESHOLD_SECONDS

    async def test_quality_scoring(self):
        """
        Tests quality scoring functionality across different content types 
        with performance validation.
        """
        try:
            self._start_time = time.time()
            
            # Test each content type
            for content_type in CONTENT_TYPES:
                test_items = [
                    item for item in mockContentItems 
                    if item['type'] == content_type
                ]
                
                for item in test_items:
                    # Analyze content quality
                    quality_score = await self._quality_analyzer.analyze_content(
                        content=item,
                        topic='machine_learning'
                    )
                    
                    # Validate quality score
                    assert quality_score >= QUALITY_THRESHOLD, \
                        f"Quality score {quality_score} below threshold for {content_type}"
                    
                    # Validate score components
                    metrics = await self._quality_analyzer.calculate_metrics(item)
                    assert 0 <= metrics.relevance_score <= 1, \
                        "Relevance score out of range"
                    assert 0 <= metrics.engagement_score <= 1, \
                        "Engagement score out of range"
                    assert 0 <= metrics.credibility_score <= 1, \
                        "Credibility score out of range"
                    
                    # Validate content type specific metrics
                    if content_type == 'video':
                        assert 'views' in item['metadata'], "Missing video views"
                        assert 'duration' in item['metadata'], "Missing video duration"
                    elif content_type == 'article':
                        assert 'word_count' in item['metadata'], "Missing word count"
                        assert 'publication_date' in item['metadata'], \
                            "Missing publication date"
            
            # Validate processing time
            processing_time = time.time() - self._start_time
            self.assert_processing_time(
                processing_time,
                self._processing_threshold,
                "Quality assessment processing"
            )

        except Exception as e:
            self.logger.error(
                "Quality scoring test failed",
                extra={
                    "error": str(e),
                    "processing_time": time.time() - self._start_time
                }
            )
            raise

    async def test_relevance_threshold(self):
        """Validates content relevance threshold enforcement with edge cases."""
        try:
            # Test boundary conditions
            test_scores = [0.89, 0.90, 0.91]
            
            for score in test_scores:
                test_content = mockContentItems[0].copy()
                test_content['quality_score'] = score
                
                if score < QUALITY_THRESHOLD:
                    with pytest.raises(ValueError) as exc_info:
                        await self._quality_analyzer.analyze_content(
                            content=test_content,
                            topic='machine_learning'
                        )
                    assert "Quality score below threshold" in str(exc_info.value)
                else:
                    result = await self._quality_analyzer.analyze_content(
                        content=test_content,
                        topic='machine_learning'
                    )
                    assert result >= QUALITY_THRESHOLD, \
                        f"Score {result} incorrectly passed threshold check"

        except Exception as e:
            self.logger.error(
                "Relevance threshold test failed",
                extra={"error": str(e)}
            )
            raise

    async def test_quality_metrics(self):
        """Tests individual quality metric calculations with detailed validation."""
        try:
            test_content = mockContentItems[0]  # Using first mock item
            
            # Test relevance calculation
            metrics = await self._quality_analyzer.calculate_metrics(test_content)
            
            # Validate relevance score
            assert metrics.relevance_score >= 0.8, \
                "Relevance score below expected threshold"
            
            # Validate engagement metrics
            if test_content['type'] == 'video':
                assert metrics.engagement_score >= 0.7, \
                    "Video engagement score below threshold"
                assert test_content['metadata']['views'] > 0, \
                    "Invalid video view count"
            
            # Validate credibility scoring
            assert metrics.credibility_score >= 0.8, \
                "Credibility score below threshold"
            
            # Validate freshness calculation
            assert metrics.freshness_score >= 0, \
                "Invalid freshness score"
            assert metrics.freshness_score <= 1, \
                "Freshness score out of range"
            
            # Validate metric aggregation
            final_score = await self._quality_analyzer.analyze_content(
                content=test_content,
                topic='machine_learning'
            )
            assert final_score >= QUALITY_THRESHOLD, \
                "Final quality score below threshold"

        except Exception as e:
            self.logger.error(
                "Quality metrics test failed",
                extra={"error": str(e)}
            )
            raise

@pytest.fixture(scope='module')
async def setup_module():
    """Module setup for quality assessment tests."""
    # Initialize test environment
    test_env = {
        'quality_analyzer': QualityAnalyzer(quality_threshold=QUALITY_THRESHOLD),
        'test_content': mockContentItems
    }
    
    # Configure test monitoring
    logger.info(
        "Initializing quality assessment test suite",
        extra={"threshold": QUALITY_THRESHOLD}
    )
    
    return test_env