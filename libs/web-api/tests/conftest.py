"""Shared test fixtures for DeepAgents Web API tests.

Provides reusable fixtures including the async HTTP client,
mock session data factories, and common mock helpers.
"""

import json
from datetime import datetime, timezone
from typing import Any, AsyncIterator
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from deepagents_web_api.main import app


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    """Async HTTP client bound to the FastAPI app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def make_session_result():
    """Factory for mock create_session return values."""

    def _make(
        thread_id: str = "20260328120000-abcd1234",
        workspace_path: str | None = None,
        created_at: str | None = None,
    ) -> dict[str, Any]:
        if created_at is None:
            created_at = datetime.now(timezone.utc).isoformat()
        if workspace_path is None:
            workspace_path = f"/tmp/agent-workspaces/{thread_id}"
        return {
            "thread_id": thread_id,
            "created_at": created_at,
            "workspace_path": workspace_path,
        }

    return _make


@pytest.fixture
def mock_sse_streaming_response():
    """Factory that creates a mock StreamingResponse for SSE endpoints.

    Returns a helper that patches stream_agent_response to return
    a real StreamingResponse with the given SSE events.
    """
    from fastapi.responses import StreamingResponse

    def _make(events: list[dict[str, Any]] | None = None) -> AsyncMock:
        if events is None:
            events = [
                {"event": "messages", "data": {"type": "ai", "content": "Hello!"}},
                {"event": "end", "data": {}},
            ]

        async def _generator() -> AsyncIterator[str]:
            for evt in events:
                yield f"data: {json.dumps(evt, ensure_ascii=False)}\n\n"

        mock = AsyncMock()
        mock.return_value = StreamingResponse(
            _generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
        return mock

    return _make
