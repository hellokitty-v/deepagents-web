"""Tests for Agent run endpoint (TC-RUN-0001 ~ TC-RUN-0019).

Covers simple Q&A streaming, invalid thread_id, validation errors,
new task execution, and follow-up conversation with history context.
"""

import json
from unittest.mock import AsyncMock, patch

import pytest


MOCK_THREAD_ID = "20260328120000-abcd1234"


def _create_session_patch():
    """Shared mock for create_session_impl used by run tests."""
    mock = AsyncMock()
    mock.return_value = {
        "thread_id": MOCK_THREAD_ID,
        "created_at": "2026-03-28T12:00:00Z",
        "workspace_path": f"/tmp/agent-workspaces/{MOCK_THREAD_ID}",
    }
    return mock


# ============================================================================
# TC-RUN-0001: Simple Q&A streaming
# ============================================================================


@patch("deepagents_web_api.main.generate_session_title", new_callable=AsyncMock)
@patch("deepagents_web_api.main.stream_agent_response", new_callable=AsyncMock)
@patch("deepagents_web_api.main.get_agent", new_callable=AsyncMock)
async def test_tc_run_0001_simple_qa_streaming(
    mock_get_agent,
    mock_stream,
    mock_title,
    client,
    mock_sse_streaming_response,
):
    """POST /api/sessions/{id}/run returns SSE stream with messages and end events."""
    mock_get_agent.return_value = AsyncMock()
    mock_title.return_value = "简单问答"

    sse_events = [
        {"event": "messages", "data": {"type": "ai", "content": "4"}},
        {"event": "end", "data": {}},
    ]
    mock_stream.return_value = mock_sse_streaming_response(sse_events).return_value

    response = await client.post(
        f"/api/sessions/{MOCK_THREAD_ID}/run",
        json={"message": "What is 2+2?"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")

    # Parse SSE lines
    body = response.text
    events = _parse_sse_body(body)
    event_types = [e["event"] for e in events]
    assert "messages" in event_types
    assert "end" in event_types

    mock_get_agent.assert_awaited_once_with(MOCK_THREAD_ID)


# ============================================================================
# TC-RUN-0004: Invalid thread_id returns 404
# ============================================================================


@patch("deepagents_web_api.main.get_agent", new_callable=AsyncMock)
async def test_tc_run_0004_invalid_thread_id(mock_get_agent, client):
    """POST /api/sessions/invalid-id/run returns 404."""
    mock_get_agent.side_effect = ValueError("Session invalid-id not found")

    response = await client.post(
        "/api/sessions/invalid-id/run",
        json={"message": "hello"},
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"]


# ============================================================================
# TC-RUN-0005: Empty message returns 422
# ============================================================================


async def test_tc_run_0005_empty_message(client):
    """POST /api/sessions/{id}/run with empty message returns 422."""
    response = await client.post(
        f"/api/sessions/{MOCK_THREAD_ID}/run",
        json={"message": ""},
    )

    assert response.status_code == 422


# ============================================================================
# TC-RUN-0006: Message too long returns 422
# ============================================================================


async def test_tc_run_0006_message_too_long(client):
    """POST /api/sessions/{id}/run with message > 50000 chars returns 422."""
    long_message = "a" * 50001

    response = await client.post(
        f"/api/sessions/{MOCK_THREAD_ID}/run",
        json={"message": long_message},
    )

    assert response.status_code == 422


# ============================================================================
# TC-RUN-0018: New task execution via unified conversation
# ============================================================================


@patch("deepagents_web_api.main.generate_session_title", new_callable=AsyncMock)
@patch("deepagents_web_api.main.stream_agent_response", new_callable=AsyncMock)
@patch("deepagents_web_api.main.get_agent", new_callable=AsyncMock)
async def test_tc_run_0018_new_task(
    mock_get_agent,
    mock_stream,
    mock_title,
    client,
    mock_sse_streaming_response,
):
    """POST /api/sessions/{id}/run with a task message returns SSE stream."""
    mock_get_agent.return_value = AsyncMock()
    mock_title.return_value = "创建Python脚本"

    sse_events = [
        {"event": "messages", "data": {"type": "ai", "content": "好的，我来创建脚本"}},
        {"event": "tool_calls", "data": {"tool_call_id": "tc1", "tool_name": "write_file", "args": {}}},
        {"event": "tool_result", "data": {"tool_call_id": "tc1", "tool_name": "write_file", "content": "ok"}},
        {"event": "messages", "data": {"type": "ai", "content": "脚本已创建完成"}},
        {"event": "end", "data": {}},
    ]
    mock_stream.return_value = mock_sse_streaming_response(sse_events).return_value

    response = await client.post(
        f"/api/sessions/{MOCK_THREAD_ID}/run",
        json={"message": "创建一个 Python 脚本"},
    )

    assert response.status_code == 200
    events = _parse_sse_body(response.text)
    event_types = [e["event"] for e in events]
    assert "tool_calls" in event_types
    assert "tool_result" in event_types
    assert event_types[-1] == "end"


# ============================================================================
# TC-RUN-0019: Follow-up question uses history context
# ============================================================================


@patch("deepagents_web_api.main.generate_session_title", new_callable=AsyncMock)
@patch("deepagents_web_api.main.stream_agent_response", new_callable=AsyncMock)
@patch("deepagents_web_api.main.get_agent", new_callable=AsyncMock)
async def test_tc_run_0019_followup_question(
    mock_get_agent,
    mock_stream,
    mock_title,
    client,
    mock_sse_streaming_response,
):
    """Two sequential runs on the same session share the same agent context."""
    agent_instance = AsyncMock()
    mock_get_agent.return_value = agent_instance
    mock_title.return_value = "测试会话"

    # First run
    first_events = [
        {"event": "messages", "data": {"type": "ai", "content": "Python是一种编程语言"}},
        {"event": "end", "data": {}},
    ]
    mock_stream.return_value = mock_sse_streaming_response(first_events).return_value

    resp1 = await client.post(
        f"/api/sessions/{MOCK_THREAD_ID}/run",
        json={"message": "什么是Python?"},
    )
    assert resp1.status_code == 200

    # Second run (follow-up)
    followup_events = [
        {"event": "messages", "data": {"type": "ai", "content": "它的优点包括简洁易读"}},
        {"event": "end", "data": {}},
    ]
    mock_stream.return_value = mock_sse_streaming_response(followup_events).return_value

    resp2 = await client.post(
        f"/api/sessions/{MOCK_THREAD_ID}/run",
        json={"message": "它有什么优点?"},
    )
    assert resp2.status_code == 200

    # Both calls used the same thread_id -> same agent
    assert mock_get_agent.await_count == 2
    for call in mock_get_agent.call_args_list:
        assert call[0][0] == MOCK_THREAD_ID

    # stream_agent_response was called with the same agent instance both times
    for call in mock_stream.call_args_list:
        assert call[0][0] is agent_instance

    # Verify second call received the follow-up message
    second_call_message = mock_stream.call_args_list[1][0][1]
    assert second_call_message == "它有什么优点?"


# ============================================================================
# Helpers
# ============================================================================


def _parse_sse_body(body: str) -> list[dict]:
    """Parse SSE response body into list of event dicts."""
    events = []
    for line in body.strip().split("\n"):
        line = line.strip()
        if line.startswith("data: "):
            payload = line[len("data: "):]
            try:
                events.append(json.loads(payload))
            except json.JSONDecodeError:
                continue
    return events
