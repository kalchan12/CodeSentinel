"""Terminal WebSocket endpoint providing pseudo-terminal (PTY) access to AI CLIs and shell."""

from __future__ import annotations

import json
import logging
import os
import shlex
from typing import Optional

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services import project_service
from app.services.pty_service import PTYSession

logger = logging.getLogger(__name__)

router = APIRouter(tags=["terminal"])

# Allowed base commands for security
ALLOWED_COMMANDS = {
    "bash": ["/bin/bash"],
    "sh": ["/bin/sh"],
    "opencode": ["opencode"],
    "opencode-auth": ["opencode", "providers"],
    "agy": ["agy"],
    "agy-auth": ["agy", "login"],
}


@router.websocket("/terminal/ws")
async def terminal_websocket(
    websocket: WebSocket,
    cmd: str = Query(default="bash"),
    project_id: Optional[int] = Query(default=None),
    cwd: Optional[str] = Query(default=None),
    rows: int = Query(default=24),
    cols: int = Query(default=80),
    prompt: Optional[str] = Query(default=None),
) -> None:
    await websocket.accept()

    # Determine working directory
    target_cwd = cwd
    if project_id is not None:
        from app.db.session import SessionLocal
        with SessionLocal() as db:
            project = project_service.get_project(db, project_id)
            if project and project.local_path and os.path.isdir(project.local_path):
                target_cwd = project.local_path

    if not target_cwd or not os.path.isdir(target_cwd):
        target_cwd = os.getcwd()

    # Build command
    if cmd in ALLOWED_COMMANDS:
        command = list(ALLOWED_COMMANDS[cmd])
    else:
        # Sanitize and resolve safe command
        tokens = shlex.split(cmd)
        base = tokens[0] if tokens else "bash"
        if base in ["bash", "sh", "opencode", "agy"]:
            command = tokens
        else:
            command = ["/bin/bash"]

    # If prompt was provided for AI CLIs, append interactive prompt argument
    if prompt and command[0] == "opencode":
        command.extend(["--prompt", prompt])
    elif prompt and command[0] == "agy":
        command.extend(["-i", prompt])

    # Find full path of binary if not absolute
    binary_name = command[0]
    if not os.path.isabs(binary_name):
        home = os.path.expanduser("~")
        candidates = [
            os.path.join(home, ".opencode", "bin", binary_name),
            os.path.join(home, ".local", "bin", binary_name),
            f"/usr/local/bin/{binary_name}",
            f"/usr/bin/{binary_name}",
            f"/bin/{binary_name}",
        ]
        for candidate in candidates:
            if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
                command[0] = candidate
                break

    loop = asyncio.get_event_loop()
    queue: asyncio.Queue[bytes] = asyncio.Queue()

    def on_output(data: bytes) -> None:
        loop.call_soon_threadsafe(queue.put_nowait, data)

    def on_exit(code: int) -> None:
        loop.call_soon_threadsafe(queue.put_nowait, b"\r\n[Process completed]\r\n")

    session = PTYSession(command=command, cwd=target_cwd, rows=rows, cols=cols)

    try:
        session.start(on_output=on_output, on_exit=on_exit)
    except Exception as exc:
        logger.exception("Failed to start PTY session: %s", exc)
        await websocket.send_text(f"\r\nFailed to start {command[0]}: {exc}\r\n")
        await websocket.close()
        return

    # Coroutine to forward PTY output to WebSocket
    async def forward_output() -> None:
        try:
            while session.is_running:
                data = await queue.get()
                await websocket.send_bytes(data)
        except Exception:
            pass

    import asyncio
    output_task = asyncio.create_task(forward_output())

    try:
        while True:
            message = await websocket.receive()
            if "bytes" in message and message["bytes"]:
                session.write(message["bytes"])
            elif "text" in message and message["text"]:
                text_data = message["text"]
                # Check for control messages
                if text_data.startswith("{") and text_data.endswith("}"):
                    try:
                        payload = json.loads(text_data)
                        msg_type = payload.get("type")
                        if msg_type == "resize":
                            r = int(payload.get("rows", 24))
                            c = int(payload.get("cols", 80))
                            session.resize(r, c)
                            continue
                        elif msg_type == "input":
                            session.write(payload.get("data", "").encode())
                            continue
                    except Exception:
                        pass
                session.write(text_data.encode())
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.debug("Terminal WebSocket closed: %s", exc)
    finally:
        output_task.cancel()
        session.close()
