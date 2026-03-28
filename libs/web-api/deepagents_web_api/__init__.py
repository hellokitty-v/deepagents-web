"""DeepAgents Web API.

HTTP REST API wrapper for DeepAgents SDK, enabling web frontends
to use Agent capabilities through browser.

This package provides:
- FastAPI-based REST API endpoints
- Server-Sent Events (SSE) for streaming responses
- Session management with SQLite persistence
- Filesystem isolation for security
- Interrupt/resume support for human-in-the-loop workflows
"""

__version__ = "0.1.0"

__all__ = ["__version__"]
