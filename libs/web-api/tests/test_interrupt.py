"""Tests for interrupt and resume functionality.

Covers TC-INT-0002 through TC-INT-0007: approve/reject/edit decisions,
invalid decisions, session not found, and multiple decisions.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.responses import StreamingResponse


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _mock_sse_generator():
    """Minimal SSE generator for mocking stream responses."""
    yield 'data: {"event": "messages", "data": {"type": "ai", "content": "Resumed"}}\n\n'
    yield 'data: {"event": "end", "data": {}}\n\n'


def _make_stream_response() -> StreamingResponse:
    return StreamingResponse(_mock_sse_generator(), media_type="text/event-stream")


# ---------------------------------------------------------------------------
# TC-INT-0002: Resume with approve decision
# ---------------------------------------------------------------------------

@patch("deepagents_web_api.main.stream_resume_response")
@patch("deepagents_web_api.main.get_agent")
async def test_tc_int_0002_resume_approve(mock_get_agent, mock_stream, client):
    """POST /api/sessions/{id}/resume with approve decision returns SSE stream."""
    mock_get_agent.return_value = MagicMock()
    mock_stream.return_value = _make_stream_response()

    response = await client.post(
        "/api/sessions/test-thread-001/resume",
        json={"decisions": [{"type": "approve"}]},
    )

    assert response.status_code == 200
    assert "text/event-stream" in response.headers.get("content-type", "")
    mock_get_agent.assert_awaited_once_with("test-thread-001")
    mock_stream.assert_awaited_once()

    # Verify decisions payload forwarded correctly
    call_args = mock_stream.call_args
    decisions_arg = call_args[0][1]  # second positional arg
    assert len(decisions_arg) == 1
    assert decisions_arg[0]["type"] == "approve"


# ---------------------------------------------------------------------------
# TC-INT-0003: Resume with reject decision
# ---------------------------------------------------------------------------

@patch("deepagents_web_api.main.stream_resume_response")
@patch("deepagents_web_api.main.get_agent")
async def test_tc_int_0003_resume_reject(mock_get_agent, mock_stream, client):
    """POST /api/sessions/{id}/resume with reject decision forwards message."""
    mock_get_agent.return_value = MagicMock()
    mock_stream.return_value = _make_stream_response()

    response = await client.post(
        "/api/sessions/test-thread-002/resume",
        json={"decisions": [{"type": "reject", "message": "Too risky"}]},
    )

    assert response.status_code == 200
    decisions_arg = mock_stream.call_args[0][1]
    assert decisions_arg[0]["type"] == "reject"
    assert decisions_arg[0]["message"] == "Too risky"


# ---------------------------------------------------------------------------
# TC-INT-0004: Resume with edit decision
# ---------------------------------------------------------------------------

@patch("deepagents_web_api.main.stream_resume_response")
@patch("deepagents_web_api.main.get_agent")
async def test_tc_int_0004_resume_edit(mock_get_agent, mock_stream, client):
    """POST /api/sessions/{id}/resume with edit decision forwards edited action."""
    mock_get_agent.return_value = MagicMock()
    mock_stream.return_value = _make_stream_response()

    edited_action = {"name": "execute", "args": {"command": "ls"}}
    response = await client.post(
        "/api/sessions/test-thread-003/resume",
        json={
            "decisions": [
                {"type": "edit", "edited_action": edited_action},
            ]
        },
    )

    assert response.status_code == 200
    decisions_arg = mock_stream.call_args[0][1]
    assert decisions_arg[0]["type"] == "edit"
    assert decisions_arg[0]["edited_action"]["name"] == "execute"
    assert decisions_arg[0]["edited_action"]["args"] == {"command": "ls"}


# ---------------------------------------------------------------------------
# TC-INT-0005: Resume with empty decisions list -> 422
# ---------------------------------------------------------------------------

async def test_tc_int_0005_resume_empty_decisions(client):
    """POST /api/sessions/{id}/resume with decisions=[] returns 422."""
    response = await client.post(
        "/api/sessions/test-thread-004/resume",
        json={"decisions": []},
    )

    assert response.status_code == 422


# ---------------------------------------------------------------------------
# TC-INT-0006: Resume with non-existent session -> 404
# ---------------------------------------------------------------------------

@patch("deepagents_web_api.main.get_agent")
async def test_tc_int_0006_resume_session_not_found(mock_get_agent, client):
    """POST /api/sessions/invalid-id/resume returns 404 when session missing."""
    mock_get_agent.side_effect = ValueError("Session invalid-id not found")

    response = await client.post(
        "/api/sessions/invalid-id/resume",
        json={"decisions": [{"type": "approve"}]},
    )

    assert response.status_code == 404
    body = response.json()
    assert "not found" in body["detail"].lower()


# ---------------------------------------------------------------------------
# TC-INT-0007: Resume with multiple decisions
# ---------------------------------------------------------------------------

@patch("deepagents_web_api.main.stream_resume_response")
@patch("deepagents_web_api.main.get_agent")
async def test_tc_int_0007_resume_multiple_decisions(
    mock_get_agent, mock_stream, client
):
    """POST /api/sessions/{id}/resume with multiple decisions forwards all."""
    mock_get_agent.return_value = MagicMock()
    mock_stream.return_value = _make_stream_response()

    response = await client.post(
        "/api/sessions/test-thread-005/resume",
        json={
            "decisions": [
                {"type": "approve"},
                {"type": "reject", "message": "Not needed"},
            ]
        },
    )

    assert response.status_code == 200
    decisions_arg = mock_stream.call_args[0][1]
    assert len(decisions_arg) == 2
    assert decisions_arg[0]["type"] == "approve"
    assert decisions_arg[1]["type"] == "reject"


# ---------------------------------------------------------------------------
# TC-INT-EXTRA-001: Resume with invalid decision type -> 422
# ---------------------------------------------------------------------------

async def test_tc_int_extra_001_resume_invalid_type(client):
    """POST /api/sessions/{id}/resume with invalid type returns 422."""
    response = await client.post(
        "/api/sessions/test-thread-006/resume",
        json={"decisions": [{"type": "unknown_type"}]},
    )

    assert response.status_code == 422
