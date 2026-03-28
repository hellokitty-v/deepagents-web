"""Tests for filesystem isolation logic.

Covers TC-FS-0001, TC-FS-0003, TC-FS-0007, TC-FS-0008: workspace creation,
file writing inside workspace, cross-session isolation, and cleanup on delete.

These tests target agent.py functions directly (unit-level), mocking only
the external SDK dependencies (deepagents, langchain, langgraph).
"""

import os
import shutil
import tempfile
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def workspace_root(tmp_path):
    """Provide a temporary workspace root directory."""
    root = tmp_path / "agent-workspaces"
    root.mkdir()
    return str(root)


@pytest.fixture
def db_path(tmp_path):
    """Provide a temporary SQLite database path and initialize schema."""
    path = str(tmp_path / "test_sessions.db")
    # Import and run schema init so create_session can INSERT
    from deepagents_web_api.agent import _init_sqlite_db
    _init_sqlite_db(path)
    return path


# ---------------------------------------------------------------------------
# TC-FS-0001: Workspace directory is created on session creation
# ---------------------------------------------------------------------------

@patch("deepagents_web_api.agent.get_checkpointer", new_callable=AsyncMock)
async def test_tc_fs_0001_workspace_created(
    mock_checkpointer, workspace_root, db_path
):
    """create_session creates a workspace directory for the new session."""
    from deepagents_web_api.agent import create_session

    result = await create_session(
        agent_config={},
        workspace_root=workspace_root,
        db_path=db_path,
    )

    workspace_path = os.path.join(workspace_root, result["thread_id"])
    assert os.path.isdir(workspace_path)
    assert result["workspace_path"] == workspace_path
    assert result["thread_id"]  # non-empty
    assert result["created_at"]  # non-empty


# ---------------------------------------------------------------------------
# TC-FS-0003: Files can be written inside the workspace directory
# ---------------------------------------------------------------------------

@patch("deepagents_web_api.agent.get_checkpointer", new_callable=AsyncMock)
async def test_tc_fs_0003_write_file_in_workspace(
    mock_checkpointer, workspace_root, db_path
):
    """Files created inside the session workspace succeed normally."""
    from deepagents_web_api.agent import create_session

    result = await create_session(
        agent_config={},
        workspace_root=workspace_root,
        db_path=db_path,
    )

    workspace_path = result["workspace_path"]
    test_file = os.path.join(workspace_path, "output.txt")

    # Simulate agent writing a file
    with open(test_file, "w", encoding="utf-8") as f:
        f.write("hello from agent")

    assert os.path.isfile(test_file)
    with open(test_file, encoding="utf-8") as f:
        assert f.read() == "hello from agent"


# ---------------------------------------------------------------------------
# TC-FS-0007: Cross-session workspace isolation
# ---------------------------------------------------------------------------

@patch("deepagents_web_api.agent.get_checkpointer", new_callable=AsyncMock)
async def test_tc_fs_0007_cross_session_isolation(
    mock_checkpointer, workspace_root, db_path
):
    """Two sessions get distinct, non-overlapping workspace directories."""
    from deepagents_web_api.agent import create_session

    session_a = await create_session(
        agent_config={},
        workspace_root=workspace_root,
        db_path=db_path,
    )
    session_b = await create_session(
        agent_config={},
        workspace_root=workspace_root,
        db_path=db_path,
    )

    path_a = session_a["workspace_path"]
    path_b = session_b["workspace_path"]

    # Paths must differ
    assert path_a != path_b
    # Both must exist
    assert os.path.isdir(path_a)
    assert os.path.isdir(path_b)

    # File in session A is not visible in session B
    with open(os.path.join(path_a, "secret.txt"), "w") as f:
        f.write("a-only")

    assert not os.path.exists(os.path.join(path_b, "secret.txt"))


# ---------------------------------------------------------------------------
# TC-FS-0008: Workspace cleaned up on session deletion
# ---------------------------------------------------------------------------

@patch("deepagents_web_api.agent.get_checkpointer", new_callable=AsyncMock)
async def test_tc_fs_0008_delete_cleans_workspace(
    mock_checkpointer, workspace_root, db_path
):
    """delete_session removes the workspace directory from disk."""
    from deepagents_web_api.agent import create_session, delete_session

    result = await create_session(
        agent_config={},
        workspace_root=workspace_root,
        db_path=db_path,
    )

    workspace_path = result["workspace_path"]
    thread_id = result["thread_id"]

    # Workspace exists before deletion
    assert os.path.isdir(workspace_path)

    deleted = await delete_session(
        thread_id=thread_id,
        workspace_root=workspace_root,
        db_path=db_path,
    )

    assert deleted is True
    # Workspace directory should be gone
    assert not os.path.exists(workspace_path)


# ---------------------------------------------------------------------------
# TC-FS-EXTRA-001: Deleting non-existent session returns False
# ---------------------------------------------------------------------------

@patch("deepagents_web_api.agent.get_checkpointer", new_callable=AsyncMock)
async def test_tc_fs_extra_001_delete_nonexistent(
    mock_checkpointer, workspace_root, db_path
):
    """delete_session returns False for a thread_id that was never created."""
    from deepagents_web_api.agent import delete_session

    deleted = await delete_session(
        thread_id="nonexistent-thread",
        workspace_root=workspace_root,
        db_path=db_path,
    )

    assert deleted is False
