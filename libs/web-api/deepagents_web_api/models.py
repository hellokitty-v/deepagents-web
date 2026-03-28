"""Pydantic data models for API requests and responses.

This module defines all data models used in the DeepAgents Web API,
including request/response schemas and configuration models.
"""

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ============================================================================
# Request Models
# ============================================================================


class AgentConfig(BaseModel):
    """Configuration for creating a new Agent session.

    Attributes:
        model: LLM model name in format "provider:model-name".
            Examples: "anthropic:claude-sonnet-4-6", "openai:gpt-4o".
        system_prompt: Custom system instructions for the Agent.
    """

    model: str = Field(
        default="anthropic:claude-sonnet-4-6",
        description="LLM model in format 'provider:model-name'",
    )
    system_prompt: Optional[str] = Field(
        default=None,
        max_length=10000,
        description="Custom system prompt for the Agent",
    )


class SessionCreateRequest(BaseModel):
    """Request model for creating a new session.

    Attributes:
        agent_config: Optional Agent configuration.
    """

    agent_config: Optional[AgentConfig] = Field(
        default=None,
        description="Agent configuration (uses defaults if not provided)",
    )


class AgentRunRequest(BaseModel):
    """Request model for running an Agent session.

    Attributes:
        message: User message to send to the Agent.
    """

    message: str = Field(
        ...,
        min_length=1,
        max_length=50000,
        description="User message (new task, follow-up, or resume)",
    )


class DecisionType(str, Enum):
    """Enumeration of interrupt decision types.

    Values:
        approve: Approve the tool call.
        reject: Reject the tool call with optional message.
        edit: Edit the tool call with modified action.
    """

    approve = "approve"
    reject = "reject"
    edit = "edit"


class EditedAction(BaseModel):
    """Edited action for interrupt decision.

    Attributes:
        name: Tool name.
        args: Tool arguments.
    """

    name: str = Field(..., description="Tool name")
    args: dict[str, Any] = Field(..., description="Tool arguments")


class InterruptDecision(BaseModel):
    """Decision for handling an interrupt request.

    Attributes:
        type: Decision type (approve/reject/edit).
        message: Optional rejection message (only for type=reject).
        edited_action: Edited action (only for type=edit).
    """

    type: DecisionType = Field(..., description="Decision type")
    message: Optional[str] = Field(
        default=None,
        description="Rejection message (required for type=reject)",
    )
    edited_action: Optional[EditedAction] = Field(
        default=None,
        description="Edited action (required for type=edit)",
    )


class ResumeRequest(BaseModel):
    """Request model for resuming an interrupted session.

    Attributes:
        decisions: List of decisions for each interrupt request.
    """

    decisions: list[InterruptDecision] = Field(
        ...,
        min_length=1,
        description="Decisions list (order must match interrupt requests)",
    )


# ============================================================================
# Response Models
# ============================================================================


class SessionCreateResponse(BaseModel):
    """Response model for session creation.

    Attributes:
        thread_id: Unique session identifier (UUID7).
        created_at: ISO 8601 timestamp of session creation.
        workspace_path: Absolute path to session workspace directory.
    """

    thread_id: str = Field(..., description="Session ID (UUID7)")
    created_at: str = Field(..., description="Creation timestamp (ISO 8601)")
    workspace_path: str = Field(..., description="Workspace directory path")


class SessionListItem(BaseModel):
    """Session item in list response.

    Attributes:
        thread_id: Session ID.
        title: Session title (auto-generated from first user message).
        created_at: Creation timestamp.
        updated_at: Last update timestamp.
        message_count: Number of messages in session.
    """

    thread_id: str = Field(..., description="Session ID")
    title: str = Field(..., description="Session title (10-20 chars)")
    created_at: str = Field(..., description="Creation timestamp (ISO 8601)")
    updated_at: str = Field(..., description="Last update timestamp (ISO 8601)")
    message_count: int = Field(..., ge=0, description="Message count")


class SessionListResponse(BaseModel):
    """Response model for session list query.

    Attributes:
        total: Total number of sessions.
        sessions: List of session items.
    """

    total: int = Field(..., ge=0, description="Total session count")
    sessions: list[SessionListItem] = Field(..., description="Session list")


class MessageItem(BaseModel):
    """Message item in session history.

    Attributes:
        type: Message type (human/ai/tool).
        content: Message content (string or dict for tool results).
        tool_calls: Tool calls (only for type=ai with tool calls).
        tool_call_id: Tool call ID (only for type=tool).
        tool_name: Tool name (only for type=tool).
        status: Tool execution status (only for type=tool).
    """

    type: str = Field(..., description="Message type (human/ai/tool)")
    content: str | dict[str, Any] = Field(..., description="Message content")
    tool_calls: Optional[list[dict[str, Any]]] = Field(
        default=None,
        description="Tool calls (for type=ai)",
    )
    tool_call_id: Optional[str] = Field(
        default=None,
        description="Tool call ID (for type=tool)",
    )
    tool_name: Optional[str] = Field(
        default=None,
        description="Tool name (for type=tool)",
    )
    status: Optional[str] = Field(
        default=None,
        description="Tool status (for type=tool): success/error",
    )


class SessionHistoryResponse(BaseModel):
    """Response model for session history query.

    Attributes:
        thread_id: Session ID.
        created_at: Creation timestamp.
        updated_at: Last update timestamp.
        message_count: Number of messages.
        messages: List of messages.
    """

    thread_id: str = Field(..., description="Session ID")
    created_at: str = Field(..., description="Creation timestamp (ISO 8601)")
    updated_at: str = Field(..., description="Last update timestamp (ISO 8601)")
    message_count: int = Field(..., ge=0, description="Message count")
    messages: list[MessageItem] = Field(..., description="Message list")


class DeleteResponse(BaseModel):
    """Response model for session deletion.

    Attributes:
        success: Whether deletion was successful.
        message: Success or error message.
    """

    success: bool = Field(..., description="Deletion success status")
    message: str = Field(..., description="Success or error message")


# ============================================================================
# File Operation Models
# ============================================================================


class FileItem(BaseModel):
    """File item in file list response.

    Attributes:
        file_id: Encoded file identifier.
        name: File name.
        path: Relative path within workspace.
        size: File size in bytes.
        created_at: File creation timestamp.
    """

    file_id: str = Field(..., description="Encoded file identifier")
    name: str = Field(..., description="File name")
    path: str = Field(..., description="Relative path within workspace")
    size: int = Field(..., ge=0, description="File size in bytes")
    created_at: str = Field(..., description="Creation timestamp (ISO 8601)")


class FileListResponse(BaseModel):
    """Response model for file list query.

    Attributes:
        thread_id: Session ID.
        files: List of files in workspace.
    """

    thread_id: str = Field(..., description="Session ID")
    files: list[FileItem] = Field(..., description="File list")


class FilePreviewResponse(BaseModel):
    """Response model for file preview.

    Attributes:
        file_id: Encoded file identifier.
        type: File type (text/image/pptx/unsupported).
        content: File content (text or base64 for images).
        mime_type: MIME type (for images).
        thumbnails: List of base64 thumbnails (for PPTX).
    """

    file_id: str = Field(..., description="Encoded file identifier")
    type: str = Field(..., description="File type")
    content: Optional[str] = Field(default=None, description="File content")
    mime_type: Optional[str] = Field(default=None, description="MIME type")
    thumbnails: Optional[list[str]] = Field(default=None, description="Thumbnails")


