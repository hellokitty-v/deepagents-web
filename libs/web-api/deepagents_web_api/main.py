"""FastAPI application entry point.

This module defines the main FastAPI application and routes for the
DeepAgents Web API service.
"""

import base64
import io
import os
import sqlite3
import zipfile
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from .agent import (
    _init_sqlite_db,
    create_session as create_session_impl,
    delete_session as delete_session_impl,
    download_all_files as download_all_files_impl,
    download_file as download_file_impl,
    generate_session_title,
    get_agent,
    get_session_history as get_session_history_impl,
    list_session_files as list_session_files_impl,
    list_sessions as list_sessions_impl,
    preview_file as preview_file_impl,
)
from .models import (
    AgentRunRequest,
    DeleteResponse,
    FileListResponse,
    FilePreviewResponse,
    ResumeRequest,
    SessionCreateRequest,
    SessionCreateResponse,
    SessionHistoryResponse,
    SessionListItem,
    SessionListResponse,
    FileItem,
)
from .streaming import stream_agent_response, stream_resume_response
from .utils import generate_file_id, parse_file_id

@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    """Initialize database on application startup."""
    _init_sqlite_db("agent_sessions.db")
    yield


app = FastAPI(
    title="DeepAgents Web API",
    description="HTTP REST API wrapper for DeepAgents SDK",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS - allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Root and Health Check Endpoints
# ============================================================================


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint returning API information.

    Returns:
        dict: API name and version information.
    """
    return {
        "name": "DeepAgents Web API",
        "version": "0.1.0",
        "description": "HTTP REST API wrapper for DeepAgents SDK",
    }


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check endpoint.

    Returns:
        dict: Service health status.
    """
    return {"status": "healthy"}


# ============================================================================
# API-001: Create Agent Session
# ============================================================================


@app.post("/api/sessions", response_model=SessionCreateResponse, status_code=201)
async def create_session(
    request: SessionCreateRequest,
) -> SessionCreateResponse:
    """Create a new Agent session.

    Args:
        request: Session creation request with optional agent config.

    Returns:
        SessionCreateResponse: Session metadata including thread_id,
            created_at, and workspace_path.

    Raises:
        HTTPException: 400 if model format is invalid,
            500 if Agent initialization fails.
    """
    try:
        agent_config = request.agent_config.model_dump() if request.agent_config else {}
        result = await create_session_impl(agent_config)
        return SessionCreateResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")


# ============================================================================
# API-002: Query Session List
# ============================================================================


@app.get("/api/sessions", response_model=SessionListResponse)
async def list_sessions(
    limit: int = Query(default=20, ge=1, le=100, description="Page size"),
    offset: int = Query(default=0, ge=0, description="Page offset"),
    order_by: Literal["created_at", "updated_at"] = Query(
        default="updated_at",
        description="Sort field",
    ),
    order: Literal["asc", "desc"] = Query(default="desc", description="Sort order"),
) -> SessionListResponse:
    """Query session list with pagination and sorting.

    Args:
        limit: Maximum number of sessions to return (1-100).
        offset: Number of sessions to skip for pagination.
        order_by: Field to sort by (created_at or updated_at).
        order: Sort order (asc or desc).

    Returns:
        SessionListResponse: Total count and list of sessions.

    Raises:
        HTTPException: 400 if parameters are invalid,
            500 if database query fails.
    """
    try:
        result = await list_sessions_impl(limit, offset, order_by, order)

        # Convert to response model
        sessions = [
            SessionListItem(
                thread_id=s["thread_id"],
                title=s.get("title") or "未命名会话",
                created_at=s["created_at"],
                updated_at=s["updated_at"],
                message_count=0  # TODO: Calculate from checkpointer
            )
            for s in result["sessions"]
        ]

        return SessionListResponse(
            total=result["total"],
            sessions=sessions
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list sessions: {str(e)}")


# ============================================================================
# API-003: Execute Agent Task (Streaming)
# ============================================================================


@app.post("/api/sessions/{thread_id}/run")
async def run_agent(
    thread_id: str,
    request: AgentRunRequest,
) -> StreamingResponse:
    """Execute Agent task with streaming SSE response.

    This is a unified conversation interface that handles:
    - New tasks
    - Follow-up questions
    - Resume after interrupts

    Args:
        thread_id: Session ID (UUID7 format).
        request: Agent run request with user message.

    Returns:
        StreamingResponse: SSE stream with events:
            - messages: Agent messages (AIMessage)
            - updates: State updates
            - tool_calls: Tool invocations
            - tool_result: Tool execution results
            - interrupt: Interrupt requests
            - end: Stream end marker

    Raises:
        HTTPException: 400 if message is invalid,
            404 if session not found,
            500 if execution fails.
    """
    try:
        # Get Agent instance
        agent = await get_agent(thread_id)

        # Generate session title on first message
        await generate_session_title(thread_id, request.message)

        # Stream Agent execution
        return await stream_agent_response(agent, request.message, thread_id)

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute Agent: {str(e)}")


# ============================================================================
# API-004: Handle Interrupt Decision
# ============================================================================


@app.post("/api/sessions/{thread_id}/resume")
async def resume_session(
    thread_id: str,
    request: ResumeRequest,
) -> StreamingResponse:
    """Resume interrupted session with user decisions.

    Args:
        thread_id: Session ID.
        request: Resume request with decisions list.

    Returns:
        StreamingResponse: SSE stream (same format as run_agent).

    Raises:
        HTTPException: 400 if decisions are invalid,
            404 if session not found,
            409 if session is not in interrupted state.
    """
    try:
        agent = await get_agent(thread_id)
        decisions = [d.model_dump() for d in request.decisions]
        return await stream_resume_response(agent, decisions, thread_id)

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to resume session: {str(e)}")


# ============================================================================
# API-005: Get Session History
# ============================================================================


@app.get("/api/sessions/{thread_id}", response_model=SessionHistoryResponse)
async def get_session_history(thread_id: str) -> SessionHistoryResponse:
    """Get complete session history with all messages.

    Args:
        thread_id: Session ID.

    Returns:
        SessionHistoryResponse: Session metadata and message list.

    Raises:
        HTTPException: 404 if session not found,
            500 if checkpointer query fails.
    """
    try:
        result = await get_session_history_impl(thread_id)
        return SessionHistoryResponse(
            thread_id=result["thread_id"],
            created_at=result["created_at"],
            updated_at=result["updated_at"],
            message_count=len(result["messages"]),
            messages=result["messages"]
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get session history: {str(e)}")


# ============================================================================
# API-006: Delete Session
# ============================================================================


@app.delete("/api/sessions/{thread_id}", response_model=DeleteResponse)
async def delete_session(thread_id: str) -> DeleteResponse:
    """Delete a session and its workspace.

    Args:
        thread_id: Session ID.

    Returns:
        DeleteResponse: Deletion success status and message.

    Raises:
        HTTPException: 404 if session not found,
            500 if deletion fails.
    """
    try:
        success = await delete_session_impl(thread_id)
        if not success:
            raise HTTPException(status_code=404, detail="Session not found")
        return DeleteResponse(success=True, message="Session deleted successfully")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete session: {str(e)}")


# ============================================================================
# API-007: Get File List
# ============================================================================


@app.get("/api/sessions/{thread_id}/files", response_model=FileListResponse)
async def list_files(
    thread_id: str,
    db_path: str = "agent_sessions.db",
) -> FileListResponse:
    """Get list of files in session workspace.

    Args:
        thread_id: Session ID.
        db_path: Path to SQLite database.

    Returns:
        FileListResponse: List of files with metadata.

    Raises:
        HTTPException: 404 if session not found,
            500 if file system access fails.
    """
    try:
        result = await list_session_files_impl(thread_id, db_path)
        return FileListResponse(
            thread_id=result["thread_id"],
            files=[FileItem(**f) for f in result["files"]]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to list files: {str(e)}"
        )


# ============================================================================
# API-008: Download File
# ============================================================================


@app.get("/api/files/{file_id}/download")
async def download_file(
    file_id: str,
    db_path: str = "agent_sessions.db",
) -> FileResponse:
    """Download a file from session workspace.

    Args:
        file_id: Encoded file identifier.
        db_path: Path to SQLite database.

    Returns:
        FileResponse: File stream with proper headers.

    Raises:
        HTTPException: 400 if file_id is invalid,
            404 if session or file not found,
            500 if file access fails.
    """
    try:
        return await download_file_impl(file_id, db_path)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to download file: {str(e)}"
        )


# ============================================================================
# API-009: Download All Files (ZIP)
# ============================================================================


@app.get("/api/sessions/{thread_id}/download-all")
async def download_all_files(
    thread_id: str,
    db_path: str = "agent_sessions.db",
) -> StreamingResponse:
    """Download all files in session workspace as ZIP.

    Args:
        thread_id: Session ID.
        db_path: Path to SQLite database.

    Returns:
        StreamingResponse: ZIP file stream.

    Raises:
        HTTPException: 404 if session not found,
            500 if ZIP creation fails.
    """
    try:
        return await download_all_files_impl(thread_id, db_path)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to create ZIP: {str(e)}"
        )


# ============================================================================
# API-011: Preview File
# ============================================================================


@app.get("/api/files/{file_id}/preview", response_model=FilePreviewResponse)
async def preview_file(
    file_id: str,
    db_path: str = "agent_sessions.db",
) -> FilePreviewResponse:
    """Preview file content (text, image, or PPTX).

    Args:
        file_id: Encoded file identifier.
        db_path: Path to SQLite database.

    Returns:
        FilePreviewResponse: File preview data based on type.

    Raises:
        HTTPException: 400 if file_id is invalid,
            404 if session or file not found,
            415 if file type is not supported,
            500 if preview generation fails.
    """
    try:
        result = await preview_file_impl(file_id, db_path)
        return FilePreviewResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to preview file: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)





