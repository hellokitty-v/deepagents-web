"""Tests for session management endpoints.

Covers TC-MGT-0001 through TC-MGT-0007: session history query, deletion,
idempotent deletion, session list with default and paginated parameters.
"""

from unittest.mock import AsyncMock, patch

import pytest


# ---------------------------------------------------------------------------
# TC-MGT-0001: Get session history - normal
# ---------------------------------------------------------------------------

@patch("deepagents_web_api.main.get_session_history_impl")
async def test_tc_mgt_0001_get_session_history(mock_history, client):
    """GET /api/sessions/{id} returns 200 with messages list."""
    mock_history.return_value = {
        "thread_id": "sess-001",
        "created_at": "2026-03-28T10:00:00+00:00",
        "updated_at": "2026-03-28T10:05:00+00:00",
        "messages": [
            {"type": "human", "content": "Hello"},
            {"type": "ai", "content": "Hi there"},
        ],
    }

    response = await client.get("/api/sessions/sess-001")

    assert response.status_code == 200
    body = response.json()
    assert body["thread_id"] == "sess-001"
    assert body["message_count"] == 2
    assert isinstance(body["messages"], list)
    assert body["messages"][0]["content"] == "Hello"
    mock_history.assert_awaited_once_with("sess-001")


# ---------------------------------------------------------------------------
# TC-MGT-0002: Get session history - not found
# ---------------------------------------------------------------------------

@patch("deepagents_web_api.main.get_session_history_impl")
async def test_tc_mgt_0002_get_session_not_found(mock_history, client):
    """GET /api/sessions/invalid-id returns 404."""
    mock_history.side_effect = ValueError("Session invalid-id not found")

    response = await client.get("/api/sessions/invalid-id")

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# TC-MGT-0003: Delete session - normal
# ---------------------------------------------------------------------------

@patch("deepagents_web_api.main.delete_session_impl")
async def test_tc_mgt_0003_delete_session(mock_delete, client):
    """DELETE /api/sessions/{id} returns 200 with success=true."""
    mock_delete.return_value = True

    response = await client.delete("/api/sessions/sess-002")

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert "deleted" in body["message"].lower()
    mock_delete.assert_awaited_once_with("sess-002")


# ---------------------------------------------------------------------------
# TC-MGT-0004: Delete session - not found
# ---------------------------------------------------------------------------

@patch("deepagents_web_api.main.delete_session_impl")
async def test_tc_mgt_0004_delete_session_not_found(mock_delete, client):
    """DELETE /api/sessions/invalid-id returns 404."""
    mock_delete.return_value = False

    response = await client.delete("/api/sessions/invalid-id")

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# TC-MGT-0005: Delete session - idempotency
# ---------------------------------------------------------------------------

@patch("deepagents_web_api.main.delete_session_impl")
async def test_tc_mgt_0005_delete_session_idempotent(mock_delete, client):
    """DELETE same session twice: first 200, second 404."""
    # First call succeeds
    mock_delete.return_value = True
    resp1 = await client.delete("/api/sessions/sess-003")
    assert resp1.status_code == 200
    assert resp1.json()["success"] is True

    # Second call - session already gone
    mock_delete.return_value = False
    resp2 = await client.delete("/api/sessions/sess-003")
    assert resp2.status_code == 404


# ---------------------------------------------------------------------------
# TC-MGT-0006: List sessions - default parameters
# ---------------------------------------------------------------------------

@patch("deepagents_web_api.main.list_sessions_impl")
async def test_tc_mgt_0006_list_sessions_default(mock_list, client):
    """GET /api/sessions returns 200 with total and sessions list."""
    mock_list.return_value = {
        "total": 2,
        "sessions": [
            {
                "thread_id": "sess-a",
                "title": "First session",
                "model": "anthropic:claude-sonnet-4-6",
                "workspace_path": "/tmp/agent-workspaces/sess-a",
                "created_at": "2026-03-28T09:00:00+00:00",
                "updated_at": "2026-03-28T09:10:00+00:00",
            },
            {
                "thread_id": "sess-b",
                "title": "Second session",
                "model": "anthropic:claude-sonnet-4-6",
                "workspace_path": "/tmp/agent-workspaces/sess-b",
                "created_at": "2026-03-28T08:00:00+00:00",
                "updated_at": "2026-03-28T08:30:00+00:00",
            },
        ],
        "limit": 20,
        "offset": 0,
    }

    response = await client.get("/api/sessions")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert len(body["sessions"]) == 2
    assert body["sessions"][0]["thread_id"] == "sess-a"
    # Verify default params forwarded
    mock_list.assert_awaited_once_with(20, 0, "updated_at", "desc")


# ---------------------------------------------------------------------------
# TC-MGT-0007: List sessions - pagination
# ---------------------------------------------------------------------------

@patch("deepagents_web_api.main.list_sessions_impl")
async def test_tc_mgt_0007_list_sessions_pagination(mock_list, client):
    """GET /api/sessions?limit=5&offset=0 returns at most 5 records."""
    mock_list.return_value = {
        "total": 12,
        "sessions": [
            {
                "thread_id": f"sess-{i}",
                "title": f"Session {i}",
                "model": "anthropic:claude-sonnet-4-6",
                "workspace_path": f"/tmp/agent-workspaces/sess-{i}",
                "created_at": "2026-03-28T09:00:00+00:00",
                "updated_at": "2026-03-28T09:00:00+00:00",
            }
            for i in range(5)
        ],
        "limit": 5,
        "offset": 0,
    }

    response = await client.get("/api/sessions?limit=5&offset=0")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 12
    assert len(body["sessions"]) <= 5
    mock_list.assert_awaited_once_with(5, 0, "updated_at", "desc")
