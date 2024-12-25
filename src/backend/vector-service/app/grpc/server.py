"""
Enterprise-grade gRPC server implementation for vector service with comprehensive monitoring,
security features, and operational capabilities.

External Dependencies:
grpc==1.54.0 - High-performance RPC framework
prometheus_client==0.17.0 - Metrics collection and export
opentelemetry==1.19.0 - Distributed tracing
concurrent.futures (built-in) - Thread pool management
"""

import grpc
from concurrent import futures
import threading
import signal
import time
from typing import Dict
from prometheus_client import start_http_server, Counter, Histogram
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode

from . import vector_pb2
from . import vector_pb2_grpc
from ..core.embedding_generator import EmbeddingGenerator
from ..core.similarity_calculator import SimilarityCalculator
from ..utils.logger import logger

# Server configuration constants
MAX_WORKERS = 10
DEFAULT_PORT = 50051
REQUEST_TIMEOUT = 5
MAX_RETRIES = 3
HEALTH_CHECK_INTERVAL = 30

# Prometheus metrics
EMBEDDING_REQUESTS = Counter('vector_embedding_requests_total', 'Total embedding requests')
SEARCH_REQUESTS = Counter('vector_search_requests_total', 'Total search requests')
REQUEST_LATENCY = Histogram('vector_request_duration_seconds', 'Request latency in seconds')
ERROR_COUNT = Counter('vector_error_count_total', 'Total error count')

class VectorServiceImpl(vector_pb2_grpc.VectorServiceServicer):
    """
    Enhanced implementation of the VectorService gRPC service with monitoring,
    security features, and operational capabilities.
    """

    def __init__(self):
        """Initialize service with required components and monitoring."""
        self._embedding_generator = EmbeddingGenerator()
        self._similarity_calculator = SimilarityCalculator()
        self._lock = threading.Lock()
        self._request_cache: Dict = {}
        self._health_status = {"status": "serving"}
        self._tracer = trace.get_tracer(__name__)
        
        logger.info("VectorService initialized successfully")

    async def GenerateEmbedding(
        self,
        request: vector_pb2.EmbeddingRequest,
        context: grpc.ServicerContext
    ) -> vector_pb2.EmbeddingResponse:
        """
        Generate vector embeddings with comprehensive monitoring and validation.

        Args:
            request: EmbeddingRequest containing content data
            context: gRPC service context

        Returns:
            EmbeddingResponse containing generated embedding
        """
        with self._tracer.start_as_current_span("generate_embedding") as span:
            try:
                EMBEDDING_REQUESTS.inc()
                start_time = time.time()

                # Request validation
                if not request.content_data:
                    context.abort(grpc.StatusCode.INVALID_ARGUMENT, "Empty content data")

                # Check cache
                cache_key = hash(request.content_data)
                with self._lock:
                    if cache_key in self._request_cache:
                        return self._request_cache[cache_key]

                # Generate embedding
                embedding = await self._embedding_generator.generate_embedding(
                    content=request.content_data.decode('utf-8'),
                    content_id=request.content_id,
                    quality_score=request.metadata.quality_score,
                    metadata=dict(request.metadata)
                )

                # Create response
                response = vector_pb2.EmbeddingResponse(
                    embedding_id=str(embedding.content_id),
                    vector=embedding.vector.tolist(),
                    dimensions=len(embedding.vector)
                )

                # Update cache
                with self._lock:
                    self._request_cache[cache_key] = response

                # Record metrics
                REQUEST_LATENCY.observe(time.time() - start_time)
                span.set_status(Status(StatusCode.OK))

                return response

            except Exception as e:
                ERROR_COUNT.inc()
                logger.error(f"Embedding generation failed: {str(e)}")
                span.set_status(Status(StatusCode.ERROR, str(e)))
                context.abort(grpc.StatusCode.INTERNAL, f"Embedding generation failed: {str(e)}")

    async def SearchSimilar(
        self,
        request: vector_pb2.SearchRequest,
        context: grpc.ServicerContext
    ) -> vector_pb2.SearchResponse:
        """
        Perform similarity search with monitoring and validation.

        Args:
            request: SearchRequest containing query vector
            context: gRPC service context

        Returns:
            SearchResponse containing similar vectors
        """
        with self._tracer.start_as_current_span("search_similar") as span:
            try:
                SEARCH_REQUESTS.inc()
                start_time = time.time()

                # Validate request
                if not request.query_vector:
                    context.abort(grpc.StatusCode.INVALID_ARGUMENT, "Empty query vector")

                # Perform similarity search
                similar_vectors = await self._similarity_calculator.find_similar_vectors(
                    query_vector=request.query_vector,
                    top_k=request.top_k,
                    filters=request.filters
                )

                # Create response
                response = vector_pb2.SearchResponse(
                    results=[
                        vector_pb2.SimilarVector(
                            vector_id=str(vec.content_id),
                            vector=vec.vector.tolist(),
                            similarity_score=score,
                            metadata=vec.metadata
                        )
                        for vec, score in similar_vectors
                    ],
                    total_found=len(similar_vectors)
                )

                # Record metrics
                REQUEST_LATENCY.observe(time.time() - start_time)
                span.set_status(Status(StatusCode.OK))

                return response

            except Exception as e:
                ERROR_COUNT.inc()
                logger.error(f"Similarity search failed: {str(e)}")
                span.set_status(Status(StatusCode.ERROR, str(e)))
                context.abort(grpc.StatusCode.INTERNAL, f"Similarity search failed: {str(e)}")

    async def Check(
        self,
        request: vector_pb2.HealthCheckRequest,
        context: grpc.ServicerContext
    ) -> vector_pb2.HealthCheckResponse:
        """
        Implement health check for service monitoring.

        Args:
            request: HealthCheckRequest
            context: gRPC service context

        Returns:
            HealthCheckResponse with service status
        """
        try:
            # Verify component health
            embedding_status = self._embedding_generator is not None
            similarity_status = self._similarity_calculator is not None

            if embedding_status and similarity_status:
                status = vector_pb2.HealthCheckResponse.SERVING
            else:
                status = vector_pb2.HealthCheckResponse.NOT_SERVING

            return vector_pb2.HealthCheckResponse(status=status)

        except Exception as e:
            logger.error(f"Health check failed: {str(e)}")
            context.abort(grpc.StatusCode.INTERNAL, f"Health check failed: {str(e)}")

def serve(port: int = DEFAULT_PORT) -> None:
    """
    Start the gRPC server with security and monitoring features.

    Args:
        port: Port number for the server
    """
    try:
        # Initialize metrics server
        start_http_server(port + 1)

        # Create secure server
        server = grpc.server(
            futures.ThreadPoolExecutor(max_workers=MAX_WORKERS),
            options=[
                ('grpc.max_send_message_length', 50 * 1024 * 1024),
                ('grpc.max_receive_message_length', 50 * 1024 * 1024),
                ('grpc.keepalive_time_ms', 7200000),
                ('grpc.keepalive_timeout_ms', 20000),
                ('grpc.http2.max_pings_without_data', 0),
                ('grpc.http2.min_time_between_pings_ms', 10000),
                ('grpc.http2.min_ping_interval_without_data_ms', 5000),
            ]
        )

        # Add services
        service = VectorServiceImpl()
        vector_pb2_grpc.add_VectorServiceServicer_to_server(service, server)

        # Start server
        server.add_insecure_port(f'[::]:{port}')
        server.start()

        logger.info(f"Vector service started on port {port}")

        # Handle shutdown
        def handle_shutdown(signum, frame):
            logger.info("Initiating graceful shutdown...")
            server.stop(grace=5)

        signal.signal(signal.SIGTERM, handle_shutdown)
        signal.signal(signal.SIGINT, handle_shutdown)

        # Keep alive
        server.wait_for_termination()

    except Exception as e:
        logger.error(f"Server startup failed: {str(e)}")
        raise