"""
HTTP test client utility for making requests to backend services during testing.
Provides standardized request handling, response validation, and test-specific
HTTP client functionality with comprehensive logging and security features.

Version: 1.0.0
"""

import json
import contextlib
from typing import Optional, Dict, Any, Generator, Union
from urllib.parse import urljoin

import httpx  # v0.24.0
import pytest  # v7.0.0

from .test_logger import TestLogger, configure_test_logger
from .test_helpers import TestBase

# Constants for client configuration
DEFAULT_TIMEOUT = 30.0
DEFAULT_HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "X-Test-Client": "true"
}
SENSITIVE_HEADERS = ["Authorization", "Cookie", "X-API-Key"]

class TestClient:
    """
    Enhanced HTTP client for making test requests to backend services with
    comprehensive logging and security features.
    """

    def __init__(
        self,
        base_url: str,
        headers: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = None,
        verify_ssl: Optional[bool] = None,
        logger_config: Optional[Dict] = None
    ) -> None:
        """
        Initializes test client with enhanced configuration and security features.

        Args:
            base_url: Base URL for all requests
            headers: Optional custom headers
            timeout: Optional request timeout
            verify_ssl: Optional SSL verification flag
            logger_config: Optional logger configuration
        """
        # Validate base URL
        if not base_url:
            raise ValueError("Base URL is required")

        # Initialize client configuration
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout or DEFAULT_TIMEOUT
        self.verify_ssl = verify_ssl if verify_ssl is not None else True
        
        # Initialize headers with security defaults
        self.headers = DEFAULT_HEADERS.copy()
        if headers:
            self.headers.update(headers)

        # Initialize test logger
        self.logger = configure_test_logger(
            test_name="test_client",
            log_level=logger_config.get("log_level", "INFO") if logger_config else "INFO",
            test_suite_context={"client": "TestClient"}
        )

        # Initialize metrics tracking
        self.metrics = {
            "requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "total_response_time": 0.0
        }

        # Initialize HTTP client with security settings
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            headers=self.headers,
            timeout=self.timeout,
            verify=self.verify_ssl,
            follow_redirects=True
        )

    async def get(
        self,
        endpoint: str,
        params: Optional[Dict] = None,
        headers: Optional[Dict[str, str]] = None,
        validate_schema: bool = True
    ) -> httpx.Response:
        """
        Makes GET request to endpoint with enhanced logging and validation.

        Args:
            endpoint: API endpoint path
            params: Optional query parameters
            headers: Optional request headers
            validate_schema: Whether to validate response schema

        Returns:
            Validated HTTP response
        """
        # Validate endpoint
        if not endpoint:
            raise ValueError("Endpoint is required")

        # Prepare request
        url = urljoin(self.base_url, endpoint.lstrip('/'))
        request_headers = self._merge_headers(headers)
        
        try:
            # Log sanitized request details
            self.logger.log_request(
                method="GET",
                url=url,
                headers=self._sanitize_headers(request_headers),
                params=params
            )

            # Make request with metrics tracking
            start_time = pytest.helpers.time.time()
            response = await self._client.get(
                url=endpoint,
                params=params,
                headers=request_headers
            )
            duration = pytest.helpers.time.time() - start_time

            # Update metrics
            self._update_metrics(response.status_code, duration)

            # Log sanitized response
            self.logger.log_response(
                status_code=response.status_code,
                headers=self._sanitize_headers(dict(response.headers)),
                body=response.text,
                duration=duration
            )

            # Validate response if required
            if validate_schema:
                self._validate_response(response)

            return response

        except Exception as e:
            self.metrics["failed_requests"] += 1
            self.logger.log_error(
                error=str(e),
                context={
                    "endpoint": endpoint,
                    "method": "GET"
                }
            )
            raise

    async def post(
        self,
        endpoint: str,
        json_data: Optional[Dict] = None,
        headers: Optional[Dict[str, str]] = None,
        validate_schema: bool = True
    ) -> httpx.Response:
        """
        Makes POST request to endpoint with data validation and security checks.

        Args:
            endpoint: API endpoint path
            json_data: Optional JSON request body
            headers: Optional request headers
            validate_schema: Whether to validate response schema

        Returns:
            Validated HTTP response
        """
        # Validate endpoint and data
        if not endpoint:
            raise ValueError("Endpoint is required")

        # Prepare request
        url = urljoin(self.base_url, endpoint.lstrip('/'))
        request_headers = self._merge_headers(headers)
        
        try:
            # Log sanitized request details
            self.logger.log_request(
                method="POST",
                url=url,
                headers=self._sanitize_headers(request_headers),
                body=self._sanitize_request_body(json_data)
            )

            # Make request with metrics tracking
            start_time = pytest.helpers.time.time()
            response = await self._client.post(
                url=endpoint,
                json=json_data,
                headers=request_headers
            )
            duration = pytest.helpers.time.time() - start_time

            # Update metrics
            self._update_metrics(response.status_code, duration)

            # Log sanitized response
            self.logger.log_response(
                status_code=response.status_code,
                headers=self._sanitize_headers(dict(response.headers)),
                body=response.text,
                duration=duration
            )

            # Validate response if required
            if validate_schema:
                self._validate_response(response)

            return response

        except Exception as e:
            self.metrics["failed_requests"] += 1
            self.logger.log_error(
                error=str(e),
                context={
                    "endpoint": endpoint,
                    "method": "POST"
                }
            )
            raise

    def _merge_headers(self, headers: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        """
        Merges custom headers with defaults, maintaining security headers.

        Args:
            headers: Custom headers to merge

        Returns:
            Merged headers dictionary
        """
        merged = self.headers.copy()
        if headers:
            merged.update(headers)
        return merged

    def _sanitize_headers(self, headers: Dict[str, str]) -> Dict[str, str]:
        """
        Sanitizes sensitive information from headers for logging.

        Args:
            headers: Headers to sanitize

        Returns:
            Sanitized headers dictionary
        """
        sanitized = headers.copy()
        for header in SENSITIVE_HEADERS:
            if header.lower() in sanitized:
                sanitized[header] = "[REDACTED]"
        return sanitized

    def _sanitize_request_body(self, data: Optional[Dict]) -> Optional[Dict]:
        """
        Sanitizes sensitive information from request body for logging.

        Args:
            data: Request body to sanitize

        Returns:
            Sanitized request body
        """
        if not data:
            return data

        sensitive_keys = {"password", "token", "secret", "key"}
        sanitized = json.loads(json.dumps(data))  # Deep copy

        def _redact_sensitive(obj: Union[Dict, list]) -> Union[Dict, list]:
            if isinstance(obj, dict):
                return {
                    k: "[REDACTED]" if any(s in k.lower() for s in sensitive_keys)
                    else _redact_sensitive(v) if isinstance(v, (dict, list)) else v
                    for k, v in obj.items()
                }
            elif isinstance(obj, list):
                return [_redact_sensitive(i) if isinstance(i, (dict, list)) else i
                       for i in obj]
            return obj

        return _redact_sensitive(sanitized)

    def _validate_response(self, response: httpx.Response) -> None:
        """
        Validates response status and schema.

        Args:
            response: Response to validate

        Raises:
            AssertionError: If validation fails
        """
        # Validate status code
        if not 200 <= response.status_code < 300:
            raise AssertionError(
                f"Invalid response status: {response.status_code}"
            )

        # Validate content type
        content_type = response.headers.get("content-type", "")
        if "application/json" in content_type:
            try:
                response.json()
            except json.JSONDecodeError as e:
                raise AssertionError(f"Invalid JSON response: {str(e)}")

    def _update_metrics(self, status_code: int, duration: float) -> None:
        """
        Updates request metrics for monitoring.

        Args:
            status_code: Response status code
            duration: Request duration in seconds
        """
        self.metrics["requests"] += 1
        self.metrics["total_response_time"] += duration
        
        if 200 <= status_code < 300:
            self.metrics["successful_requests"] += 1
        else:
            self.metrics["failed_requests"] += 1

    async def close(self) -> None:
        """Closes the HTTP client connection and performs cleanup."""
        await self._client.aclose()
        self.logger.end_test(
            test_name="test_client",
            passed=self.metrics["failed_requests"] == 0,
            final_context={"metrics": self.metrics}
        )

@pytest.fixture
@contextlib.asynccontextmanager
async def create_test_client(
    base_url: str,
    headers: Optional[Dict[str, str]] = None,
    timeout: Optional[float] = None,
    verify_ssl: Optional[bool] = None,
    logger_config: Optional[Dict] = None
) -> Generator[TestClient, None, None]:
    """
    Creates and configures a test HTTP client instance with enhanced logging
    and security features.

    Args:
        base_url: Base URL for all requests
        headers: Optional custom headers
        timeout: Optional request timeout
        verify_ssl: Optional SSL verification flag
        logger_config: Optional logger configuration

    Yields:
        Configured test client instance
    """
    client = TestClient(
        base_url=base_url,
        headers=headers,
        timeout=timeout,
        verify_ssl=verify_ssl,
        logger_config=logger_config
    )
    
    try:
        yield client
    finally:
        await client.close()