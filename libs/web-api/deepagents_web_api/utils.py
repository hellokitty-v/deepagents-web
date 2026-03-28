"""Utility functions for file operations.

This module provides helper functions for file ID generation and parsing,
used in file operation APIs.
"""

import base64


def generate_file_id(thread_id: str, file_path: str) -> str:
    """Generate file_id from thread_id and file_path.

    The file_id format is: {thread_id}_{base64_encoded_path}
    Uses URL-safe base64 encoding without padding.

    Args:
        thread_id: Session identifier.
        file_path: Relative file path within workspace.

    Returns:
        Encoded file_id string.

    Example:
        >>> generate_file_id("20240320-abc123", "workspace/report.pptx")
        '20240320-abc123_d29ya3NwYWNlL3JlcG9ydC5wcHR4'
    """
    path_bytes = file_path.encode('utf-8')
    path_b64 = base64.urlsafe_b64encode(path_bytes).decode('ascii').rstrip('=')
    return f"{thread_id}_{path_b64}"


def parse_file_id(file_id: str) -> tuple[str, str]:
    """Parse file_id to extract thread_id and file_path.

    Args:
        file_id: Encoded file identifier.

    Returns:
        Tuple of (thread_id, file_path).

    Raises:
        ValueError: If file_id format is invalid.

    Example:
        >>> parse_file_id("20240320-abc123_d29ya3NwYWNlL3JlcG9ydC5wcHR4")
        ('20240320-abc123', 'workspace/report.pptx')
    """
    parts = file_id.split('_', 1)
    if len(parts) != 2:
        raise ValueError("Invalid file_id format")

    thread_id, path_b64 = parts
    # Add padding if needed
    padding = '=' * (4 - len(path_b64) % 4) if len(path_b64) % 4 else ''
    path_bytes = base64.urlsafe_b64decode(path_b64 + padding)
    return thread_id, path_bytes.decode('utf-8')
