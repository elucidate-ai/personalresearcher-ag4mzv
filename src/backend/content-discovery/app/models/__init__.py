"""
Models package initialization module for the Content Discovery Service.
Provides centralized access to Content and Topic models with lazy loading pattern
for optimal performance and clean separation of concerns.

Version: 1.0.0
"""

# Standard library imports
from typing import List, Type, Any
import logging
import sys
from importlib import import_module
from functools import lru_cache

# Configure logging
logger = logging.getLogger(__name__)

# Define exported models
__all__ = ["Content", "Topic"]

# Cache for lazy-loaded model classes
_model_cache = {}

@lru_cache(maxsize=None)
def _load_model(model_name: str) -> Type[Any]:
    """
    Lazily loads model classes when first accessed.
    Implements caching to prevent repeated imports.

    Args:
        model_name: Name of the model class to load

    Returns:
        Loaded model class

    Raises:
        ImportError: If model class cannot be loaded
    """
    try:
        # Map model names to their modules
        model_modules = {
            "Content": "content",
            "Topic": "topic"
        }
        
        if model_name not in model_modules:
            raise ImportError(f"Unknown model: {model_name}")
            
        module_name = model_modules[model_name]
        
        # Check cache first
        if model_name in _model_cache:
            return _model_cache[model_name]
            
        # Import module and get class
        module = import_module(f".{module_name}", package="app.models")
        model_class = getattr(module, model_name)
        
        # Cache the loaded class
        _model_cache[model_name] = model_class
        
        logger.debug(f"Loaded model class: {model_name}")
        return model_class
        
    except Exception as e:
        logger.error(f"Failed to load model {model_name}: {str(e)}")
        raise ImportError(f"Could not load model {model_name}") from e

def __getattr__(name: str) -> Type[Any]:
    """
    Implements lazy loading for model classes.
    Only loads models when they are first accessed.

    Args:
        name: Name of the attribute being accessed

    Returns:
        Requested model class

    Raises:
        AttributeError: If attribute is not a known model
    """
    if name in __all__:
        return _load_model(name)
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")

def get_available_models() -> List[str]:
    """
    Returns list of available model names.
    Useful for introspection and validation.

    Returns:
        List of model names that can be imported
    """
    return __all__.copy()

# Clean up namespace
del List, Type, Any, logging, sys, import_module, lru_cache