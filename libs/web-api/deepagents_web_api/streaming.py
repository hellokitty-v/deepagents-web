"""Server-Sent Events (SSE) streaming utilities.

This module provides utilities for streaming Agent execution events
to clients using the SSE protocol. It converts LangGraph's 3-tuple
format to frontend-friendly JSON events.
"""

import json
import logging
from typing import Any, AsyncIterator

from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, ToolMessage
from langgraph.types import Command

logger = logging.getLogger(__name__)

# SSE response headers to prevent buffering
_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


def _format_sse(event: dict) -> str:
    """Format a dict as an SSE data line.

    Args:
        event: Event dict with "event" and "data" keys.

    Returns:
        SSE-formatted string.
    """
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


async def _process_stream_chunks(
    agent: Any,
    stream_input: Any,
    config: dict,
) -> AsyncIterator[str]:
    """Process LangGraph stream chunks and yield SSE events.

    This is the shared core logic for both initial execution and
    interrupt resumption. It converts LangGraph's 3-tuple format
    (namespace, stream_mode, data) into frontend-friendly JSON events.

    Args:
        agent: Compiled Agent graph instance.
        stream_input: Input to pass to agent.astream (dict or Command).
        config: LangGraph config with thread_id.

    Yields:
        SSE-formatted event strings.
    """
    async for chunk in agent.astream(
        stream_input,
        config=config,
        stream_mode=["messages", "updates"],
        subgraphs=True,
    ):
        # Parse 3-tuple: (namespace, stream_mode, data)
        namespace, stream_mode, data = chunk

        if stream_mode == "messages":
            if isinstance(data, AIMessage):
                # Emit AI message content
                if data.content:
                    yield _format_sse({
                        "event": "messages",
                        "data": {"type": "ai", "content": data.content},
                    })

                # Emit tool_calls from AIMessage
                if data.tool_calls:
                    for tc in data.tool_calls:
                        yield _format_sse({
                            "event": "tool_calls",
                            "data": {
                                "tool_call_id": tc["id"],
                                "tool_name": tc["name"],
                                "args": tc["args"],
                            },
                        })

            elif isinstance(data, ToolMessage):
                yield _format_sse({
                    "event": "tool_result",
                    "data": {
                        "tool_call_id": data.tool_call_id,
                        "tool_name": data.name,
                        "content": data.content,
                    },
                })

        elif stream_mode == "updates":
            if "__interrupt__" in data:
                interrupt_info = data["__interrupt__"][0]
                yield _format_sse({
                    "event": "interrupt",
                    "data": {
                        "action_requests": interrupt_info.get("action_requests", []),
                        "review_configs": interrupt_info.get("review_configs", []),
                    },
                })
                # Pause stream on interrupt
                return

            else:
                yield _format_sse({
                    "event": "updates",
                    "data": data,
                })

    # Stream completed normally
    yield _format_sse({"event": "end", "data": {}})


async def stream_agent_response(
    agent: Any,
    message: str,
    thread_id: str,
) -> StreamingResponse:
    """Stream Agent execution events as SSE response.

    Args:
        agent: Compiled Agent graph instance.
        message: User message to send to the Agent.
        thread_id: Session identifier.

    Returns:
        StreamingResponse: SSE stream with formatted events.
    """
    async def event_generator() -> AsyncIterator[str]:
        try:
            config = {"configurable": {"thread_id": thread_id}}
            stream_input = {"messages": [("user", message)]}

            async for sse_line in _process_stream_chunks(agent, stream_input, config):
                yield sse_line

        except Exception as e:
            logger.error(f"Error streaming Agent response: {e}", exc_info=True)
            yield _format_sse({"event": "error", "data": {"message": str(e)}})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


async def stream_resume_response(
    agent: Any,
    decisions: list[dict],
    thread_id: str,
) -> StreamingResponse:
    """Resume interrupted session and stream execution events.

    Args:
        agent: Compiled Agent graph instance.
        decisions: List of interrupt decisions from user.
        thread_id: Session identifier.

    Returns:
        StreamingResponse: SSE stream with formatted events.
    """
    async def event_generator() -> AsyncIterator[str]:
        try:
            config = {"configurable": {"thread_id": thread_id}}
            hitl_response = {"decisions": decisions}

            async for sse_line in _process_stream_chunks(
                agent, Command(resume=hitl_response), config
            ):
                yield sse_line

        except Exception as e:
            logger.error(f"Error resuming Agent session: {e}", exc_info=True)
            yield _format_sse({"event": "error", "data": {"message": str(e)}})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )
