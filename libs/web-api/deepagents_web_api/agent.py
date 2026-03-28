"""Agent management and session handling.

This module provides the core logic for managing DeepAgents sessions,
including session creation, state management, and Agent execution.
"""

import asyncio
import logging
import os
import shutil
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from deepagents import create_deep_agent
from deepagents.backends import FilesystemBackend
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import AIMessage, HumanMessage
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.graph.state import CompiledStateGraph

logger = logging.getLogger(__name__)


# Global checkpointer instance
_checkpointer: AsyncSqliteSaver | None = None
_agent_cache: dict[str, CompiledStateGraph] = {}


def _init_sqlite_db(db_path: str) -> None:
    """Initialize SQLite database with WAL mode for better concurrency.

    Args:
        db_path: Path to SQLite database file.
    """
    conn = sqlite3.connect(db_path)
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.execute("PRAGMA cache_size=-64000")  # 64MB cache

        # Create sessions table for metadata
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                thread_id TEXT PRIMARY KEY,
                title TEXT,
                model TEXT,
                system_prompt TEXT,
                workspace_path TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.commit()
    finally:
        conn.close()


def _generate_thread_id() -> str:
    """Generate UUID7 thread_id (time-ordered).

    Returns:
        UUID7 string.
    """
    # UUID7 is time-ordered, but Python's uuid module doesn't support it yet
    # Use UUID4 with timestamp prefix as workaround
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    random_part = str(uuid.uuid4())[:8]
    return f"{timestamp}-{random_part}"


async def get_checkpointer(db_path: str) -> AsyncSqliteSaver:
    """Get or create global checkpointer instance.

    Args:
        db_path: Path to SQLite database file.

    Returns:
        AsyncSqliteSaver instance.
    """
    global _checkpointer
    if _checkpointer is None:
        _init_sqlite_db(db_path)
        _checkpointer = AsyncSqliteSaver.from_conn_string(f"sqlite:///{db_path}")
        await _checkpointer.setup()
    return _checkpointer


async def create_session(
    agent_config: dict[str, Any],
    workspace_root: str = "/tmp/agent-workspaces",
    db_path: str = "agent_sessions.db",
) -> dict[str, Any]:
    """Create new Agent session.

    Args:
        agent_config: Agent configuration (model, system_prompt).
        workspace_root: Root directory for session workspaces.
        db_path: Path to SQLite database.

    Returns:
        Session metadata including thread_id, workspace_path, created_at.
    """
    thread_id = _generate_thread_id()
    workspace = os.path.join(workspace_root, thread_id)
    os.makedirs(workspace, exist_ok=True)

    created_at = datetime.now(timezone.utc).isoformat()

    # Store session metadata in SQLite
    conn = sqlite3.connect(db_path)
    try:
        conn.execute(
            """
            INSERT INTO sessions (thread_id, title, model, system_prompt, workspace_path, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                thread_id,
                None,  # Title will be generated after first message
                agent_config.get("model", "anthropic:claude-sonnet-4-6"),
                agent_config.get("system_prompt"),
                workspace,
                created_at,
                created_at,
            ),
        )
        conn.commit()
    finally:
        conn.close()

    logger.info(f"Created session {thread_id} with workspace {workspace}")

    return {
        "thread_id": thread_id,
        "workspace_path": workspace,
        "created_at": created_at,
    }


async def get_agent(
    thread_id: str,
    workspace_root: str = "/tmp/agent-workspaces",
    db_path: str = "agent_sessions.db",
) -> CompiledStateGraph:
    """Get or create Agent instance for session.

    Args:
        thread_id: Session identifier.
        workspace_root: Root directory for session workspaces.
        db_path: Path to SQLite database.

    Returns:
        Compiled Agent graph.

    Raises:
        ValueError: If session not found.
    """
    # Check cache first
    if thread_id in _agent_cache:
        return _agent_cache[thread_id]

    # Load session config from database
    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.execute(
            "SELECT model, system_prompt, workspace_path FROM sessions WHERE thread_id = ?",
            (thread_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Session {thread_id} not found")

        model_name, system_prompt, workspace_path = row
    finally:
        conn.close()

    # Create filesystem backend with isolation
    backend = FilesystemBackend(root_dir=workspace_path, virtual_mode=True)

    # Get checkpointer
    checkpointer = await get_checkpointer(db_path)

    # Create Agent
    model = ChatAnthropic(model_name=model_name.split(":")[-1])
    graph = create_deep_agent(
        model=model,
        system_prompt=system_prompt,
        backend=backend,
        checkpointer=checkpointer,
    )

    # Cache the agent
    _agent_cache[thread_id] = graph

    logger.info(f"Created Agent for session {thread_id}")
    return graph


async def get_session_history(
    thread_id: str,
    db_path: str = "agent_sessions.db",
) -> dict[str, Any]:
    """Get session history and metadata.

    Args:
        thread_id: Session identifier.
        db_path: Path to SQLite database.

    Returns:
        Session data including messages and metadata.

    Raises:
        ValueError: If session not found.
    """
    # Load session metadata
    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.execute(
            "SELECT title, model, workspace_path, created_at, updated_at FROM sessions WHERE thread_id = ?",
            (thread_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Session {thread_id} not found")

        title, model, workspace_path, created_at, updated_at = row
    finally:
        conn.close()

    # Load messages from checkpointer
    checkpointer = await get_checkpointer(db_path)
    config = {"configurable": {"thread_id": thread_id}}

    try:
        tup = await checkpointer.aget_tuple(config)
        if tup and tup.checkpoint:
            messages = tup.checkpoint.get("channel_values", {}).get("messages", [])
            # Convert LangChain messages to JSON
            messages_json = [_message_to_dict(msg) for msg in messages]
        else:
            messages_json = []
    except Exception as e:
        logger.warning(f"Failed to load messages for {thread_id}: {e}")
        messages_json = []

    return {
        "thread_id": thread_id,
        "title": title,
        "model": model,
        "workspace_path": workspace_path,
        "created_at": created_at,
        "updated_at": updated_at,
        "messages": messages_json,
    }


def _message_to_dict(msg: Any) -> dict[str, Any]:
    """Convert LangChain message to JSON dict.

    Args:
        msg: LangChain message object.

    Returns:
        Message as dict.
    """
    if isinstance(msg, HumanMessage):
        return {"role": "user", "content": msg.content}
    elif isinstance(msg, AIMessage):
        return {"role": "assistant", "content": msg.content}
    else:
        return {"role": "system", "content": str(msg.content)}


async def delete_session(
    thread_id: str,
    workspace_root: str = "/tmp/agent-workspaces",
    db_path: str = "agent_sessions.db",
) -> bool:
    """Delete session and cleanup resources.

    Args:
        thread_id: Session identifier.
        workspace_root: Root directory for session workspaces.
        db_path: Path to SQLite database.

    Returns:
        True if deleted, False if not found.
    """
    # Remove from cache
    _agent_cache.pop(thread_id, None)

    # Delete workspace directory
    workspace = os.path.join(workspace_root, thread_id)
    if os.path.exists(workspace):
        try:
            shutil.rmtree(workspace)
            logger.info(f"Deleted workspace {workspace}")
        except Exception as e:
            logger.error(f"Failed to delete workspace {workspace}: {e}")

    # Delete from database
    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.execute(
            "DELETE FROM sessions WHERE thread_id = ?",
            (thread_id,),
        )
        deleted = cursor.rowcount > 0
        conn.commit()
    finally:
        conn.close()

    if deleted:
        logger.info(f"Deleted session {thread_id}")
    else:
        logger.warning(f"Session {thread_id} not found")

    return deleted


async def list_sessions(
    limit: int = 50,
    offset: int = 0,
    order_by: str = "created_at",
    order: str = "desc",
    db_path: str = "agent_sessions.db",
) -> dict[str, Any]:
    """List sessions with pagination.

    Args:
        limit: Maximum number of sessions to return.
        offset: Number of sessions to skip.
        order_by: Field to order by (created_at, updated_at).
        order: Sort order (asc, desc).
        db_path: Path to SQLite database.

    Returns:
        Dict with sessions list and total count.
    """
    # Validate parameters
    if order_by not in ["created_at", "updated_at"]:
        order_by = "created_at"
    if order not in ["asc", "desc"]:
        order = "desc"

    conn = sqlite3.connect(db_path)
    try:
        # Get total count
        cursor = conn.execute("SELECT COUNT(*) FROM sessions")
        total = cursor.fetchone()[0]

        # Get sessions
        query = f"""
            SELECT thread_id, title, model, workspace_path, created_at, updated_at
            FROM sessions
            ORDER BY {order_by} {order.upper()}
            LIMIT ? OFFSET ?
        """
        cursor = conn.execute(query, (limit, offset))
        rows = cursor.fetchall()

        sessions = [
            {
                "thread_id": row[0],
                "title": row[1],
                "model": row[2],
                "workspace_path": row[3],
                "created_at": row[4],
                "updated_at": row[5],
            }
            for row in rows
        ]
    finally:
        conn.close()

    return {
        "sessions": sessions,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


async def generate_session_title(
    thread_id: str,
    user_message: str,
    db_path: str = "agent_sessions.db",
) -> str:
    """Generate session title based on first user message.

    Args:
        thread_id: Session identifier.
        user_message: First user message.
        db_path: Path to SQLite database.

    Returns:
        Generated title.
    """
    try:
        # Use LLM to generate title
        model = ChatAnthropic(model_name="claude-sonnet-4-6")
        prompt = f"基于用户问题生成一个简洁的会话标题（10-20字）：{user_message}"

        response = await model.ainvoke([HumanMessage(content=prompt)])
        title = response.content.strip()

        # Update database
        conn = sqlite3.connect(db_path)
        try:
            conn.execute(
                "UPDATE sessions SET title = ?, updated_at = ? WHERE thread_id = ?",
                (title, datetime.now(timezone.utc).isoformat(), thread_id),
            )
            conn.commit()
        finally:
            conn.close()

        logger.info(f"Generated title for session {thread_id}: {title}")
        return title

    except Exception as e:
        logger.error(f"Failed to generate title for {thread_id}: {e}")
        # Fallback to default title
        default_title = f"新会话 {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}"

        conn = sqlite3.connect(db_path)
        try:
            conn.execute(
                "UPDATE sessions SET title = ?, updated_at = ? WHERE thread_id = ?",
                (default_title, datetime.now(timezone.utc).isoformat(), thread_id),
            )
            conn.commit()
        finally:
            conn.close()

        return default_title


# ============================================================================
# File Operations
# ============================================================================

async def list_session_files(
    thread_id: str,
    db_path: str = "agent_sessions.db",
) -> dict[str, Any]:
    """List all files in session workspace.

    Args:
        thread_id: Session identifier.
        db_path: Path to SQLite database.

    Returns:
        Dictionary with thread_id and list of file metadata.

    Raises:
        HTTPException: If session not found.
    """
    from fastapi import HTTPException
    from .utils import generate_file_id

    # Verify session exists and get workspace path
    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.execute(
            "SELECT workspace_path FROM sessions WHERE thread_id = ?",
            (thread_id,)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Session not found")
        workspace_path = row[0]
    finally:
        conn.close()

    # List all files in workspace
    files = []
    workspace = Path(workspace_path)
    if workspace.exists():
        for file_path in workspace.rglob("*"):
            if file_path.is_file():
                rel_path = file_path.relative_to(workspace)
                stat = file_path.stat()
                files.append({
                    "file_id": generate_file_id(thread_id, str(rel_path)),
                    "name": file_path.name,
                    "path": str(rel_path),
                    "size": stat.st_size,
                    "created_at": datetime.fromtimestamp(
                        stat.st_ctime, tz=timezone.utc
                    ).isoformat(),
                })

    return {
        "thread_id": thread_id,
        "files": files,
    }


async def download_file(
    file_id: str,
    db_path: str = "agent_sessions.db",
):
    """Download a specific file.

    Args:
        file_id: Encoded file identifier.
        db_path: Path to SQLite database.

    Returns:
        FileResponse for the requested file.

    Raises:
        HTTPException: If file_id invalid, file not found, or path unsafe.
    """
    from fastapi import HTTPException
    from fastapi.responses import FileResponse
    from .utils import parse_file_id

    # Parse file_id
    try:
        thread_id, file_path = parse_file_id(file_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file_id format")

    # Security: prevent path traversal
    normalized = os.path.normpath(file_path)
    if normalized.startswith("..") or os.path.isabs(normalized):
        raise HTTPException(status_code=400, detail="Invalid file path")

    # Get workspace path
    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.execute(
            "SELECT workspace_path FROM sessions WHERE thread_id = ?",
            (thread_id,)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Session not found")
        workspace_path = row[0]
    finally:
        conn.close()

    # Check file exists
    full_path = os.path.join(workspace_path, file_path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=full_path,
        filename=os.path.basename(file_path),
    )


async def download_all_files(
    thread_id: str,
    db_path: str = "agent_sessions.db",
):
    """Download all files in session workspace as ZIP.

    Args:
        thread_id: Session identifier.
        db_path: Path to SQLite database.

    Returns:
        StreamingResponse with ZIP file.

    Raises:
        HTTPException: If session not found.
    """
    import io
    import zipfile
    from fastapi import HTTPException
    from fastapi.responses import StreamingResponse

    # Verify session exists and get workspace path
    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.execute(
            "SELECT workspace_path FROM sessions WHERE thread_id = ?",
            (thread_id,)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Session not found")
        workspace_path = row[0]
    finally:
        conn.close()

    # Create ZIP in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        workspace = Path(workspace_path)
        if workspace.exists():
            for file_path in workspace.rglob("*"):
                if file_path.is_file():
                    rel_path = file_path.relative_to(workspace)
                    zip_file.write(file_path, arcname=rel_path)

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename={thread_id}_files.zip"
        }
    )


async def preview_file(
    file_id: str,
    db_path: str = "agent_sessions.db",
) -> dict[str, Any]:
    """Preview file content.

    Args:
        file_id: Encoded file identifier.
        db_path: Path to SQLite database.

    Returns:
        Dictionary with file preview data.

    Raises:
        HTTPException: If file not found or format unsupported.
    """
    import base64
    from fastapi import HTTPException
    from .utils import parse_file_id

    # Parse file_id
    try:
        thread_id, file_path = parse_file_id(file_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file_id format")

    # Security: prevent path traversal
    normalized = os.path.normpath(file_path)
    if normalized.startswith("..") or os.path.isabs(normalized):
        raise HTTPException(status_code=400, detail="Invalid file path")

    # Get workspace path
    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.execute(
            "SELECT workspace_path FROM sessions WHERE thread_id = ?",
            (thread_id,)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Session not found")
        workspace_path = row[0]
    finally:
        conn.close()

    # Check file exists
    full_path = os.path.join(workspace_path, file_path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")

    # Determine file type and generate preview
    ext = Path(file_path).suffix.lower()

    # Text files
    text_exts = {'.txt', '.md', '.py', '.json', '.yaml', '.yml',
                 '.xml', '.html', '.css', '.js'}
    if ext in text_exts:
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return {
            "file_id": file_id,
            "type": "text",
            "content": content,
        }

    # Image files
    image_exts = {'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg'}
    if ext in image_exts:
        with open(full_path, 'rb') as f:
            image_data = f.read()
        content_b64 = base64.b64encode(image_data).decode('ascii')
        mime_type = f"image/{ext[1:]}"
        if ext == '.jpg':
            mime_type = "image/jpeg"
        elif ext == '.svg':
            mime_type = "image/svg+xml"
        return {
            "file_id": file_id,
            "type": "image",
            "content": content_b64,
            "mime_type": mime_type,
        }

    # PPTX files
    if ext == '.pptx':
        try:
            from pptx import Presentation
            from PIL import Image
            import io

            prs = Presentation(full_path)
            thumbnails = []

            for slide_idx, slide in enumerate(prs.slides):
                # Create a simple thumbnail (placeholder implementation)
                # In production, you'd render the slide properly
                img = Image.new('RGB', (320, 240), color='white')
                buffer = io.BytesIO()
                img.save(buffer, format='PNG')
                buffer.seek(0)
                thumb_b64 = base64.b64encode(buffer.read()).decode('ascii')
                thumbnails.append(thumb_b64)

            return {
                "file_id": file_id,
                "type": "pptx",
                "thumbnails": thumbnails,
            }
        except ImportError:
            raise HTTPException(
                status_code=415,
                detail="PPTX preview requires python-pptx and Pillow"
            )

    # Unsupported format
    raise HTTPException(
        status_code=415,
        detail=f"Preview not supported for {ext} files"
    )

