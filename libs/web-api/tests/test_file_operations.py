"""Tests for file operation endpoints (API-007, API-008, API-009, API-011).

Covers:
- TC-FILE-0001 ~ TC-FILE-0004: API-007 (GET /api/sessions/{thread_id}/files)
- TC-FILE-0005 ~ TC-FILE-0009: API-008 (GET /api/files/{file_id}/download)
- TC-FILE-0010 ~ TC-FILE-0012: API-009 (GET /api/sessions/{thread_id}/download-all)
- TC-FILE-0013 ~ TC-FILE-0017: API-011 (GET /api/files/{file_id}/preview)

These tests follow TDD principles: written before implementation.
"""

import base64
import io
import os
import zipfile
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest


# ============================================================================
# Helper: file_id encoding/decoding (will be implemented in utils)
# ============================================================================

def generate_file_id(thread_id: str, file_path: str) -> str:
    """Generate file_id from thread_id and file_path."""
    path_bytes = file_path.encode('utf-8')
    path_b64 = base64.urlsafe_b64encode(path_bytes).decode('ascii').rstrip('=')
    return f"{thread_id}_{path_b64}"


def parse_file_id(file_id: str) -> tuple[str, str]:
    """Parse file_id to extract thread_id and file_path."""
    thread_id, path_b64 = file_id.split('_', 1)
    padding = '=' * (4 - len(path_b64) % 4) if len(path_b64) % 4 else ''
    path_bytes = base64.urlsafe_b64decode(path_b64 + padding)
    return thread_id, path_bytes.decode('utf-8')


# ============================================================================
# API-007: GET /api/sessions/{thread_id}/files
# ============================================================================

# TC-FILE-0001: Normal file list retrieval
@patch("deepagents_web_api.main.list_session_files_impl", new_callable=AsyncMock)
async def test_tc_file_0001_list_files_normal(mock_list, client):
    """GET /api/sessions/{thread_id}/files returns file list with correct structure."""
    thread_id = "01JBQR8X9Y2Z3A4B5C6D7E8F9G"
    mock_list.return_value = {
        "thread_id": thread_id,
        "files": [
            {
                "file_id": generate_file_id(thread_id, "workspace/report.pptx"),
                "name": "report.pptx",
                "path": "workspace/report.pptx",
                "size": 1048576,
                "created_at": "2024-03-20T10:30:00Z"
            },
            {
                "file_id": generate_file_id(thread_id, "output.txt"),
                "name": "output.txt",
                "path": "output.txt",
                "size": 256,
                "created_at": "2024-03-20T10:31:00Z"
            }
        ]
    }

    response = await client.get(f"/api/sessions/{thread_id}/files")

    assert response.status_code == 200
    data = response.json()
    assert data["thread_id"] == thread_id
    assert len(data["files"]) == 2
    assert data["files"][0]["name"] == "report.pptx"
    assert data["files"][0]["size"] == 1048576
    assert data["files"][1]["name"] == "output.txt"
    mock_list.assert_awaited_once_with(thread_id, "agent_sessions.db")


# TC-FILE-0002: Empty workspace returns empty list
@patch("deepagents_web_api.main.list_session_files_impl", new_callable=AsyncMock)
async def test_tc_file_0002_list_files_empty(mock_list, client):
    """GET /api/sessions/{thread_id}/files returns empty list for empty workspace."""
    thread_id = "01JBQR8X9Y2Z3A4B5C6D7E8F9G"
    mock_list.return_value = {
        "thread_id": thread_id,
        "files": []
    }

    response = await client.get(f"/api/sessions/{thread_id}/files")

    assert response.status_code == 200
    data = response.json()
    assert data["thread_id"] == thread_id
    assert data["files"] == []


# TC-FILE-0003: Invalid thread_id returns 404
@patch("deepagents_web_api.main.list_session_files_impl", new_callable=AsyncMock)
async def test_tc_file_0003_list_files_invalid_thread(mock_list, client):
    """GET /api/sessions/{thread_id}/files returns 404 for non-existent session."""
    from fastapi import HTTPException

    mock_list.side_effect = HTTPException(status_code=404, detail="Session not found")

    response = await client.get("/api/sessions/nonexistent-thread/files")

    assert response.status_code == 404


# TC-FILE-0004: Chinese filename encoding
@patch("deepagents_web_api.main.list_session_files_impl", new_callable=AsyncMock)
async def test_tc_file_0004_list_files_chinese_name(mock_list, client):
    """GET /api/sessions/{thread_id}/files correctly encodes Chinese filenames."""
    thread_id = "01JBQR8X9Y2Z3A4B5C6D7E8F9G"
    chinese_filename = "测试报告.docx"
    mock_list.return_value = {
        "thread_id": thread_id,
        "files": [
            {
                "file_id": generate_file_id(thread_id, chinese_filename),
                "name": chinese_filename,
                "path": chinese_filename,
                "size": 2048,
                "created_at": "2024-03-20T10:30:00Z"
            }
        ]
    }

    response = await client.get(f"/api/sessions/{thread_id}/files")

    assert response.status_code == 200
    data = response.json()
    assert data["files"][0]["name"] == chinese_filename
    # Verify file_id can be parsed back
    parsed_thread, parsed_path = parse_file_id(data["files"][0]["file_id"])
    assert parsed_thread == thread_id
    assert parsed_path == chinese_filename


# ============================================================================
# API-008: GET /api/files/{file_id}/download
# ============================================================================

# TC-FILE-0005: Normal file download
@patch("deepagents_web_api.main.download_file_impl", new_callable=AsyncMock)
async def test_tc_file_0005_download_file_normal(mock_download, client, tmp_path):
    """GET /api/files/{file_id}/download returns file with correct headers."""
    from fastapi.responses import FileResponse

    thread_id = "01JBQR8X9Y2Z3A4B5C6D7E8F9G"
    file_path = "output.txt"
    file_id = generate_file_id(thread_id, file_path)

    # Create a temporary file
    temp_file = tmp_path / "output.txt"
    temp_file.write_text("test content")

    # Mock FileResponse with real file
    mock_download.return_value = FileResponse(
        path=str(temp_file),
        filename="output.txt",
        media_type="text/plain"
    )

    response = await client.get(f"/api/files/{file_id}/download")

    assert response.status_code == 200
    mock_download.assert_awaited_once_with(file_id, "agent_sessions.db")


# TC-FILE-0006: Invalid file_id format returns 400
async def test_tc_file_0006_download_invalid_file_id(client):
    """GET /api/files/{file_id}/download returns 400 for malformed file_id."""
    invalid_file_id = "invalid-format-without-underscore"

    response = await client.get(f"/api/files/{invalid_file_id}/download")

    assert response.status_code == 400
    assert "invalid" in response.json()["detail"].lower()


# TC-FILE-0007: File not found returns 404
@patch("deepagents_web_api.main.download_file_impl", new_callable=AsyncMock)
async def test_tc_file_0007_download_file_not_found(mock_download, client):
    """GET /api/files/{file_id}/download returns 404 when file doesn't exist."""
    from fastapi import HTTPException

    thread_id = "01JBQR8X9Y2Z3A4B5C6D7E8F9G"
    file_id = generate_file_id(thread_id, "nonexistent.txt")
    mock_download.side_effect = HTTPException(status_code=404, detail="File not found")

    response = await client.get(f"/api/files/{file_id}/download")

    assert response.status_code == 404


# TC-FILE-0008: Path traversal attack blocked
async def test_tc_file_0008_download_path_traversal(client):
    """GET /api/files/{file_id}/download rejects path traversal attempts."""
    thread_id = "01JBQR8X9Y2Z3A4B5C6D7E8F9G"
    malicious_path = "../../etc/passwd"
    file_id = generate_file_id(thread_id, malicious_path)

    response = await client.get(f"/api/files/{file_id}/download")

    assert response.status_code == 400
    assert "path" in response.json()["detail"].lower()


# TC-FILE-0009: Chinese filename download
@patch("deepagents_web_api.main.download_file_impl", new_callable=AsyncMock)
async def test_tc_file_0009_download_chinese_filename(mock_download, client, tmp_path):
    """GET /api/files/{file_id}/download handles Chinese filenames correctly."""
    from fastapi.responses import FileResponse

    thread_id = "01JBQR8X9Y2Z3A4B5C6D7E8F9G"
    chinese_filename = "测试文档.pdf"
    file_id = generate_file_id(thread_id, chinese_filename)

    # Create a temporary file
    temp_file = tmp_path / "test.pdf"
    temp_file.write_bytes(b"fake pdf content")

    mock_download.return_value = FileResponse(
        path=str(temp_file),
        filename=chinese_filename,
        media_type="application/pdf"
    )

    response = await client.get(f"/api/files/{file_id}/download")

    assert response.status_code == 200
    mock_download.assert_awaited_once_with(file_id, "agent_sessions.db")


# ============================================================================
# API-009: GET /api/sessions/{thread_id}/download-all
# ============================================================================

# TC-FILE-0010: Normal batch download as ZIP
@patch("deepagents_web_api.main.download_all_files_impl", new_callable=AsyncMock)
async def test_tc_file_0010_download_all_normal(mock_download_all, client):
    """GET /api/sessions/{thread_id}/download-all returns ZIP with all files."""
    from fastapi.responses import StreamingResponse

    thread_id = "01JBQR8X9Y2Z3A4B5C6D7E8F9G"

    # Create a mock ZIP file in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("output.txt", "test content")
        zf.writestr("report.pptx", b"fake pptx data")
    zip_buffer.seek(0)

    async def mock_generator():
        yield zip_buffer.read()

    mock_download_all.return_value = StreamingResponse(
        mock_generator(),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={thread_id}.zip"}
    )

    response = await client.get(f"/api/sessions/{thread_id}/download-all")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    mock_download_all.assert_awaited_once_with(thread_id, "agent_sessions.db")


# TC-FILE-0011: Empty workspace returns empty ZIP
@patch("deepagents_web_api.main.download_all_files_impl", new_callable=AsyncMock)
async def test_tc_file_0011_download_all_empty(mock_download_all, client):
    """GET /api/sessions/{thread_id}/download-all returns empty ZIP for empty workspace."""
    from fastapi.responses import StreamingResponse

    thread_id = "01JBQR8X9Y2Z3A4B5C6D7E8F9G"

    # Create an empty ZIP
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        pass  # Empty ZIP
    zip_buffer.seek(0)

    async def mock_generator():
        yield zip_buffer.read()

    mock_download_all.return_value = StreamingResponse(
        mock_generator(),
        media_type="application/zip"
    )

    response = await client.get(f"/api/sessions/{thread_id}/download-all")

    assert response.status_code == 200
    # Verify it's a valid ZIP (even if empty)
    content = response.content
    zip_file = zipfile.ZipFile(io.BytesIO(content))
    assert zip_file.namelist() == []


# TC-FILE-0012: Invalid thread_id returns 404
@patch("deepagents_web_api.main.download_all_files_impl", new_callable=AsyncMock)
async def test_tc_file_0012_download_all_invalid_thread(mock_download_all, client):
    """GET /api/sessions/{thread_id}/download-all returns 404 for non-existent session."""
    from fastapi import HTTPException

    mock_download_all.side_effect = HTTPException(status_code=404, detail="Session not found")

    response = await client.get("/api/sessions/nonexistent-thread/download-all")

    assert response.status_code == 404


# ============================================================================
# API-011: GET /api/files/{file_id}/preview
# ============================================================================

# TC-FILE-0013: Text file preview
@patch("deepagents_web_api.main.preview_file_impl", new_callable=AsyncMock)
async def test_tc_file_0013_preview_text_file(mock_preview, client):
    """GET /api/files/{file_id}/preview returns text content for text files."""
    thread_id = "01JBQR8X9Y2Z3A4B5C6D7E8F9G"
    file_id = generate_file_id(thread_id, "output.txt")

    mock_preview.return_value = {
        "file_id": file_id,
        "type": "text",
        "content": "Hello, World!\nThis is a test file."
    }

    response = await client.get(f"/api/files/{file_id}/preview")

    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "text"
    assert "Hello, World!" in data["content"]
    mock_preview.assert_awaited_once_with(file_id, "agent_sessions.db")


# TC-FILE-0014: Image file preview
@patch("deepagents_web_api.main.preview_file_impl", new_callable=AsyncMock)
async def test_tc_file_0014_preview_image_file(mock_preview, client):
    """GET /api/files/{file_id}/preview returns base64 image for image files."""
    thread_id = "01JBQR8X9Y2Z3A4B5C6D7E8F9G"
    file_id = generate_file_id(thread_id, "chart.png")

    mock_preview.return_value = {
        "file_id": file_id,
        "type": "image",
        "content": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "mime_type": "image/png"
    }

    response = await client.get(f"/api/files/{file_id}/preview")

    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "image"
    assert data["mime_type"] == "image/png"
    assert len(data["content"]) > 0  # Base64 encoded image


# TC-FILE-0015: PPTX preview (thumbnail)
@patch("deepagents_web_api.main.preview_file_impl", new_callable=AsyncMock)
async def test_tc_file_0015_preview_pptx_file(mock_preview, client):
    """GET /api/files/{file_id}/preview returns thumbnail for PPTX files."""
    thread_id = "01JBQR8X9Y2Z3A4B5C6D7E8F9G"
    file_id = generate_file_id(thread_id, "presentation.pptx")

    mock_preview.return_value = {
        "file_id": file_id,
        "type": "pptx",
        "thumbnails": [
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
        ]
    }

    response = await client.get(f"/api/files/{file_id}/preview")

    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "pptx"
    assert len(data["thumbnails"]) == 2
    mock_preview.assert_awaited_once_with(file_id, "agent_sessions.db")


# TC-FILE-0016: Unsupported format returns 415
@patch("deepagents_web_api.main.preview_file_impl", new_callable=AsyncMock)
async def test_tc_file_0016_preview_unsupported_format(mock_preview, client):
    """GET /api/files/{file_id}/preview returns 415 for unsupported file types."""
    from fastapi import HTTPException

    thread_id = "01JBQR8X9Y2Z3A4B5C6D7E8F9G"
    file_id = generate_file_id(thread_id, "video.mp4")

    mock_preview.side_effect = HTTPException(
        status_code=415,
        detail="Unsupported file type for preview"
    )

    response = await client.get(f"/api/files/{file_id}/preview")

    assert response.status_code == 415


# TC-FILE-0017: File not found returns 404
@patch("deepagents_web_api.main.preview_file_impl", new_callable=AsyncMock)
async def test_tc_file_0017_preview_file_not_found(mock_preview, client):
    """GET /api/files/{file_id}/preview returns 404 when file doesn't exist."""
    from fastapi import HTTPException

    thread_id = "01JBQR8X9Y2Z3A4B5C6D7E8F9G"
    file_id = generate_file_id(thread_id, "nonexistent.txt")

    mock_preview.side_effect = HTTPException(status_code=404, detail="File not found")

    response = await client.get(f"/api/files/{file_id}/preview")

    assert response.status_code == 404

