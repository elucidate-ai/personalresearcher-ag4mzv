"""
Content Discovery Services Package
--------------------------------
Provides a unified interface for multi-source content discovery with proper encapsulation
and clean separation of concerns. Implements production-ready service classes for YouTube,
Spotify, and Google Books integrations.

Version: 1.0.0
"""

# Internal imports with explicit service class imports
from .youtube_service import YouTubeService
from .spotify_service import SpotifyService
from .books_service import GoogleBooksService

# Define package-level exports
__all__ = [
    "YouTubeService",
    "SpotifyService", 
    "GoogleBooksService"
]

# Package metadata
__version__ = "1.0.0"
__author__ = "Knowledge Curator Team"
__description__ = "Multi-source content discovery and aggregation services"

# Service-specific version information
__service_versions__ = {
    "youtube": "v3",  # YouTube Data API version
    "spotify": "v1",  # Spotify Web API version
    "google_books": "v1"  # Google Books API version
}

def get_available_services():
    """
    Returns information about available content discovery services.
    
    Returns:
        dict: Service name to class mapping with version info
    """
    return {
        "youtube": {
            "class": YouTubeService,
            "version": __service_versions__["youtube"],
            "content_type": "video"
        },
        "spotify": {
            "class": SpotifyService,
            "version": __service_versions__["spotify"],
            "content_type": "podcast"
        },
        "google_books": {
            "class": GoogleBooksService,
            "version": __service_versions__["google_books"],
            "content_type": "book"
        }
    }