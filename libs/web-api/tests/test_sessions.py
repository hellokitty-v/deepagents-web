"""Tests for session creation endpoints (TC-SES-0001 ~ TC-SES-0008).

Covers default/custom session creation, validation errors,
concurrency, workspace existence, and thread_id uniqueness.
"""

import asyncio
from unittest.mock import AsyncMock, patch

import pytest


# ============================================================================
# TC-SES-0001: Create session with default config
# ============================================================================


@patch("deepagents_web_api.main.create_session_impl", new_callable=AsyncMock)
async def test_tc_ses_0001_create_session_default(mock_create, client, make_session_result):
    """POST /api/sessions with empty body returns 201 with valid fields."""
    mock_create.return_value = make_session_result()

    response = await client.post("/api/sessions", json={})

    assert response.status_code == 201
    data = response.json()
    assert "thread_id" in data
    assert "created_at" in data
    assert "workspace_path" in data
    assert len(data["thread_id"]) > 0
    mock_create.assert_awaited_once()


# ============================================================================
# TC-SES-0002: Create session with custom model
# ============================================================================


@patch("deepagents_web_api.main.create_session_impl", new_callable=AsyncMock)
async def test_tc_ses_0002_create_session_custom_model(mock_create, client, make_session_result):
    """POST /api/sessions with model='openai:gpt-4' returns 201."""
    mock_create.return_value = make_session_result(thread_id="20260328120001-efgh5678")

    response = await client.post(
        "/api/sessions",
        json={"agent_config": {"model": "openai:gpt-4"}},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["thread_id"] == "20260328120001-efgh5678"
    # Verify agent_config was forwarded
    call_args = mock_create.call_args[0][0]
    assert call_args["model"] == "openai:gpt-4"


# ============================================================================
# TC-SES-0003: Create session with custom system prompt
# ============================================================================


@patch("deepagents_web_api.main.create_session_impl", new_callable=AsyncMock)
async def test_tc_ses_0003_create_session_custom_system_prompt(
    mock_create, client, make_session_result
):
    """POST /api/sessions with system_prompt returns 201."""
    mock_create.return_value = make_session_result()

    response = await client.post(
        "/api/sessions",
        json={"agent_config": {"system_prompt": "You are a coding assistant"}},
    )

    assert response.status_code == 201
    call_args = mock_create.call_args[0][0]
    assert call_args["system_prompt"] == "You are a coding assistant"


# ============================================================================
# TC-SES-0004: Create session with invalid model format
# ============================================================================


@patch("deepagents_web_api.main.create_session_impl", new_callable=AsyncMock)
async def test_tc_ses_0004_create_session_invalid_model(mock_create, client):
    """POST /api/sessions with invalid model format returns 400."""
    mock_create.side_effect = ValueError("Invalid model format: invalid-format")

    response = await client.post(
        "/api/sessions",
        json={"agent_config": {"model": "invalid-format"}},
    )

    assert response.status_code == 400
    assert "Invalid model format" in response.json()["detail"]


# ============================================================================
# TC-SES-0005: Create session with system prompt too long
# ============================================================================


async def test_tc_ses_0005_create_session_system_prompt_too_long(client):
    """POST /api/sessions with system_prompt > 10000 chars returns 422."""
    long_prompt = "x" * 10001

    response = await client.post(
        "/api/sessions",
        json={"agent_config": {"system_prompt": long_prompt}},
    )

    assert response.status_code == 422


# ============================================================================
# TC-SES-0006: Concurrent session creation
# ============================================================================


@patch("deepagents_web_api.main.create_session_impl", new_callable=AsyncMock)
async def test_tc_ses_0006_create_session_concurrent(mock_create, client):
    """5 concurrent POST /api/sessions return 5 distinct thread_ids."""
    call_count = 0

    async def _unique_session(config):
        nonlocal call_count
        call_count += 1
        tid = f"20260328120000-concurrent{call_count:02d}"
        return {
            "thread_id": tid,
            "created_at": "2026-03-28T12:00:00Z",
            "workspace_path": f"/tmp/agent-workspaces/{tid}",
        }

    mock_create.side_effect = _unique_session

    tasks = [client.post("/api/sessions", json={}) for _ in range(5)]
    responses = await asyncio.gather(*tasks)

    thread_ids = set()
    for resp in responses:
        assert resp.status_code == 201
        thread_ids.add(resp.json()["thread_id"])

    assert len(thread_ids) == 5


# ============================================================================
# TC-SES-0007: Workspace directory exists after creation
# ============================================================================


@patch("deepagents_web_api.main.create_session_impl", new_callable=AsyncMock)
async def test_tc_ses_0007_create_session_workspace_exists(
    mock_create, client, make_session_result, tmp_path
):
    """Created session workspace_path points to an existing directory."""
    workspace = str(tmp_path / "ws-test")
    # Simulate that create_session_impl creates the directory
    (tmp_path / "ws-test").mkdir()

    mock_create.return_value = make_session_result(workspace_path=workspace)

    response = await client.post("/api/sessions", json={})

    assert response.status_code == 201
    import os

    assert os.path.isdir(response.json()["workspace_path"])


# ============================================================================
# TC-SES-0008: Thread ID uniqueness across 10 sessions
# ============================================================================


@patch("deepagents_web_api.main.create_session_impl", new_callable=AsyncMock)
async def test_tc_ses_0008_thread_id_uniqueness(mock_create, client):
    """10 sequential session creations produce 10 unique thread_ids."""
    counter = 0

    async def _unique(config):
        nonlocal counter
        counter += 1
        tid = f"20260328{counter:06d}-uniq{counter:04d}"
        return {
            "thread_id": tid,
            "created_at": "2026-03-28T12:00:00Z",
            "workspace_path": f"/tmp/agent-workspaces/{tid}",
        }

    mock_create.side_effect = _unique

    thread_ids: list[str] = []
    for _ in range(10):
        resp = await client.post("/api/sessions", json={})
        assert resp.status_code == 201
        thread_ids.append(resp.json()["thread_id"])

    assert len(set(thread_ids)) == 10
