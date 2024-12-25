"""
Integration tests for relationship mapping functionality in the knowledge organization service.
Validates relationship extraction, analysis, persistence, and filtering with comprehensive
performance and security validation.

Version: 1.0.0
"""

import pytest
import asyncio
import numpy as np
from datetime import datetime, timezone
from typing import Dict, List, Optional

from ../../utils.python.test_helpers import TestBase
from ../../../backend/knowledge-organization/app/core/relationship_extractor import (
    RelationshipExtractor,
    SIMILARITY_THRESHOLD,
    MAX_RELATIONSHIPS_PER_NODE,
    RELATIONSHIP_WEIGHTS
)

# Test configuration constants
TEST_GRAPH_ID = "test-graph-123"
PERFORMANCE_THRESHOLD_MS = 5000  # 5 seconds
WEIGHT_NORMALIZATION_FACTOR = 1.0
MIN_RELATIONSHIPS_PER_NODE = 10

@pytest.mark.asyncio
@pytest.mark.integration
class TestRelationshipMapping(TestBase):
    """
    Integration test suite for relationship mapping functionality including weight calculation,
    filtering, and performance validation.
    """

    def __init__(self):
        """Initialize test suite with required components and monitoring."""
        super().__init__()
        self._relationship_extractor = RelationshipExtractor()
        self.test_graph_data = {}
        self.correlation_id = None
        self.performance_metrics = {}

    async def setup_method(self, method):
        """Set up test environment with required data and monitoring."""
        await super().setup_method(method)
        
        # Initialize test correlation ID
        self.correlation_id = f"test-{datetime.now(timezone.utc).isoformat()}"
        
        # Load test graph data
        self.test_graph_data = {
            "nodes": [
                {
                    "id": "node1",
                    "label": "CONCEPT",
                    "name": "Machine Learning",
                    "vector": np.random.rand(384),  # Match PINECONE_DIMENSION
                    "quality_score": 0.9,
                    "level": 1
                },
                {
                    "id": "node2",
                    "label": "CONCEPT",
                    "name": "Neural Networks",
                    "vector": np.random.rand(384),
                    "quality_score": 0.85,
                    "level": 2
                },
                {
                    "id": "node3",
                    "label": "CONCEPT",
                    "name": "Deep Learning",
                    "vector": np.random.rand(384),
                    "quality_score": 0.95,
                    "level": 2
                }
            ]
        }
        
        # Initialize performance monitoring
        self.performance_metrics = {
            "start_time": datetime.now(timezone.utc),
            "operations": []
        }

        self.logger.info(
            "Test setup completed",
            extra={
                "correlation_id": self.correlation_id,
                "test_nodes": len(self.test_graph_data["nodes"])
            }
        )

    async def test_extract_relationships(self):
        """
        Test relationship extraction between knowledge nodes with performance validation.
        """
        try:
            # Start performance timer
            start_time = datetime.now(timezone.utc)
            
            # Extract relationships
            relationships = await self._relationship_extractor.extract_relationships(
                self.test_graph_data["nodes"]
            )
            
            # Record execution time
            execution_time = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
            
            # Validate relationship count
            assert len(relationships) > 0, "No relationships extracted"
            
            # Verify minimum relationships per node requirement
            node_relationship_counts = {}
            for rel in relationships:
                node_relationship_counts[rel.source_id] = node_relationship_counts.get(rel.source_id, 0) + 1
                node_relationship_counts[rel.target_id] = node_relationship_counts.get(rel.target_id, 0) + 1
            
            for node_id, count in node_relationship_counts.items():
                assert count >= MIN_RELATIONSHIPS_PER_NODE, f"Node {node_id} has insufficient relationships"
            
            # Validate relationship properties
            for relationship in relationships:
                # Verify relationship type
                assert relationship.type in RELATIONSHIP_WEIGHTS.keys(), \
                    f"Invalid relationship type: {relationship.type}"
                
                # Verify weight normalization
                assert 0.0 <= relationship.weight <= 1.0, \
                    f"Invalid relationship weight: {relationship.weight}"
                
                # Verify metadata
                assert "similarity_score" in relationship.metadata, \
                    "Missing similarity score in metadata"
                assert relationship.metadata["similarity_score"] >= SIMILARITY_THRESHOLD, \
                    "Relationship below similarity threshold"
            
            # Verify performance
            assert execution_time <= PERFORMANCE_THRESHOLD_MS, \
                f"Relationship extraction exceeded performance threshold: {execution_time}ms"
            
            self.logger.info(
                "Relationship extraction test completed",
                extra={
                    "correlation_id": self.correlation_id,
                    "relationships_count": len(relationships),
                    "execution_time_ms": execution_time
                }
            )

        except Exception as e:
            self.logger.error(
                f"Relationship extraction test failed: {str(e)}",
                extra={"correlation_id": self.correlation_id}
            )
            raise

    async def test_relationship_type_determination(self):
        """
        Test accuracy of relationship type determination with different node configurations.
        """
        try:
            # Test prerequisite relationship
            source_node = {
                "id": "prereq1",
                "level": 1,
                "vector": np.random.rand(384)
            }
            target_node = {
                "id": "prereq2",
                "level": 2,
                "vector": np.random.rand(384)
            }
            
            rel_type = self._relationship_extractor.determine_relationship_type(
                source_node,
                target_node,
                similarity_score=0.85
            )
            assert rel_type == "IS_PREREQUISITE", "Failed to detect prerequisite relationship"
            
            # Test containment relationship
            source_node = {
                "id": "container",
                "scope": "machine_learning",
                "vector": np.random.rand(384)
            }
            target_node = {
                "id": "contained",
                "scope": "machine_learning.neural_networks",
                "vector": np.random.rand(384)
            }
            
            rel_type = self._relationship_extractor.determine_relationship_type(
                source_node,
                target_node,
                similarity_score=0.9
            )
            assert rel_type == "CONTAINS", "Failed to detect containment relationship"
            
            self.logger.info(
                "Relationship type determination test completed",
                extra={"correlation_id": self.correlation_id}
            )

        except Exception as e:
            self.logger.error(
                f"Relationship type determination test failed: {str(e)}",
                extra={"correlation_id": self.correlation_id}
            )
            raise

    async def test_relationship_weight_calculation(self):
        """
        Test calculation and normalization of relationship weights.
        """
        try:
            # Test weight calculation for different relationship types
            for rel_type, base_weight in RELATIONSHIP_WEIGHTS.items():
                weight = self._relationship_extractor.calculate_relationship_weight(
                    rel_type,
                    similarity_score=0.9,
                    quality_factors={
                        "source_quality": 0.8,
                        "target_quality": 0.9
                    }
                )
                
                # Verify weight bounds
                assert 0.0 <= weight <= 1.0, f"Invalid weight calculated for {rel_type}"
                
                # Verify weight reflects base weight
                assert abs(weight - (base_weight * 0.9 * 0.85)) <= 0.01, \
                    f"Incorrect weight calculation for {rel_type}"
            
            # Test weight normalization
            weights = []
            for _ in range(5):
                weight = self._relationship_extractor.calculate_relationship_weight(
                    "IS_RELATED",
                    similarity_score=np.random.rand(),
                    quality_factors={
                        "source_quality": np.random.rand(),
                        "target_quality": np.random.rand()
                    }
                )
                weights.append(weight)
            
            # Verify normalization
            assert all(0.0 <= w <= 1.0 for w in weights), "Weight normalization failed"
            
            self.logger.info(
                "Relationship weight calculation test completed",
                extra={
                    "correlation_id": self.correlation_id,
                    "weight_samples": len(weights)
                }
            )

        except Exception as e:
            self.logger.error(
                f"Relationship weight calculation test failed: {str(e)}",
                extra={"correlation_id": self.correlation_id}
            )
            raise

    async def test_relationship_filtering(self):
        """
        Test filtering and ranking of extracted relationships.
        """
        try:
            # Generate test relationships with varying weights
            test_relationships = []
            for i in range(MAX_RELATIONSHIPS_PER_NODE * 2):
                test_relationships.append({
                    "source_id": f"source{i}",
                    "target_id": f"target{i}",
                    "type": "IS_RELATED",
                    "weight": np.random.rand(),
                    "metadata": {
                        "similarity_score": np.random.uniform(0.5, 1.0)
                    }
                })
            
            # Apply filtering
            filtered_relationships = self._relationship_extractor.filter_relationships(
                test_relationships
            )
            
            # Verify maximum relationships per node constraint
            node_counts = {}
            for rel in filtered_relationships:
                node_counts[rel["source_id"]] = node_counts.get(rel["source_id"], 0) + 1
                node_counts[rel["target_id"]] = node_counts.get(rel["target_id"], 0) + 1
                
            assert all(count <= MAX_RELATIONSHIPS_PER_NODE for count in node_counts.values()), \
                "Maximum relationships per node exceeded"
            
            # Verify similarity threshold filtering
            assert all(rel["metadata"]["similarity_score"] >= SIMILARITY_THRESHOLD 
                      for rel in filtered_relationships), \
                "Relationships below similarity threshold included"
            
            # Verify weight-based ranking
            weights = [rel["weight"] for rel in filtered_relationships]
            assert weights == sorted(weights, reverse=True), \
                "Relationships not properly ranked by weight"
            
            self.logger.info(
                "Relationship filtering test completed",
                extra={
                    "correlation_id": self.correlation_id,
                    "filtered_count": len(filtered_relationships),
                    "original_count": len(test_relationships)
                }
            )

        except Exception as e:
            self.logger.error(
                f"Relationship filtering test failed: {str(e)}",
                extra={"correlation_id": self.correlation_id}
            )
            raise

    async def teardown_method(self, method):
        """Clean up test resources and log final metrics."""
        try:
            # Calculate total execution time
            total_time = (datetime.now(timezone.utc) - self.performance_metrics["start_time"]).total_seconds() * 1000
            
            self.performance_metrics["total_execution_time_ms"] = total_time
            
            self.logger.info(
                "Test teardown completed",
                extra={
                    "correlation_id": self.correlation_id,
                    "performance_metrics": self.performance_metrics
                }
            )
            
            await super().teardown_method(method)
            
        except Exception as e:
            self.logger.error(
                f"Test teardown failed: {str(e)}",
                extra={"correlation_id": self.correlation_id}
            )
            raise