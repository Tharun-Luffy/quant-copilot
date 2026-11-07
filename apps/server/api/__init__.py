"""API endpoints package."""

from apps.server.api.chat import router as chat_router

__all__ = ["chat_router"]
