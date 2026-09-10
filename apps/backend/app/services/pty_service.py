"""Pseudo-terminal (PTY) session management for interactive terminal streaming."""

from __future__ import annotations

import asyncio
import fcntl
import logging
import os
import pty
import struct
import termios
from typing import Callable

logger = logging.getLogger(__name__)


def set_pty_size(fd: int, rows: int, cols: int) -> None:
    """Set the terminal window size on a PTY file descriptor."""
    try:
        winsize = struct.pack("HHHH", rows, cols, 0, 0)
        fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)
    except Exception as exc:
        logger.warning("Failed to set PTY window size: %s", exc)


class PTYSession:
    """Manages an active pseudo-terminal running a shell or CLI tool."""

    def __init__(
        self,
        command: list[str],
        cwd: str | None = None,
        env: dict[str, str] | None = None,
        rows: int = 24,
        cols: int = 80,
    ) -> None:
        self.command = command
        self.cwd = cwd or os.getcwd()
        self.rows = rows
        self.cols = cols
        self.master_fd: int | None = None
        self.pid: int | None = None
        self.is_running = False

        base_env = dict(os.environ)
        # Ensure user CLI binary paths are in PATH
        home = os.path.expanduser("~")
        extra_paths = [
            os.path.join(home, ".local", "bin"),
            os.path.join(home, ".opencode", "bin"),
            "/usr/local/bin",
            "/usr/bin",
            "/bin",
        ]
        current_path = base_env.get("PATH", "")
        for ep in extra_paths:
            if ep not in current_path.split(":"):
                current_path = f"{ep}:{current_path}"
        base_env["PATH"] = current_path
        base_env["TERM"] = "xterm-256color"
        base_env["COLORTERM"] = "truecolor"
        base_env["LANG"] = base_env.get("LANG", "en_US.UTF-8")

        if env:
            base_env.update(env)
        self.env = base_env

    def start(self, on_output: Callable[[bytes], None], on_exit: Callable[[int], None]) -> None:
        """Fork and start the PTY child process."""
        master_fd, slave_fd = pty.openpty()
        set_pty_size(master_fd, self.rows, self.cols)

        pid = os.fork()
        if pid == 0:
            # Child process
            os.close(master_fd)
            os.setsid()
            fcntl.ioctl(slave_fd, termios.TIOCSCTTY, 0)

            os.dup2(slave_fd, 0)
            os.dup2(slave_fd, 1)
            os.dup2(slave_fd, 2)
            if slave_fd > 2:
                os.close(slave_fd)

            try:
                os.chdir(self.cwd)
            except Exception:
                pass

            try:
                os.execvpe(self.command[0], self.command, self.env)
            except Exception as e:
                os.write(2, f"Failed to exec {self.command[0]}: {e}\n".encode())
                os._exit(1)

        # Parent process
        os.close(slave_fd)
        self.master_fd = master_fd
        self.pid = pid
        self.is_running = True

        # Non-blocking read on master_fd
        flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
        fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

        loop = asyncio.get_event_loop()

        def _reader() -> None:
            try:
                data = os.read(master_fd, 4096)
                if data:
                    on_output(data)
                else:
                    self.close()
                    on_exit(0)
            except (BlockingIOError, InterruptedError):
                pass
            except (OSError, EOFError):
                self.close()
                on_exit(0)

        loop.add_reader(master_fd, _reader)

    def write(self, data: bytes) -> None:
        """Write user input to the PTY master."""
        if self.master_fd is not None and self.is_running:
            try:
                os.write(self.master_fd, data)
            except (OSError, BlockingIOError) as exc:
                logger.debug("Error writing to PTY: %s", exc)

    def resize(self, rows: int, cols: int) -> None:
        """Resize the terminal window."""
        self.rows = rows
        self.cols = cols
        if self.master_fd is not None:
            set_pty_size(self.master_fd, rows, cols)

    def close(self) -> None:
        """Clean up PTY descriptors and child process."""
        if not self.is_running:
            return
        self.is_running = False

        if self.master_fd is not None:
            try:
                loop = asyncio.get_event_loop()
                loop.remove_reader(self.master_fd)
            except Exception:
                pass
            try:
                os.close(self.master_fd)
            except Exception:
                pass
            self.master_fd = None

        if self.pid is not None:
            try:
                os.kill(self.pid, 15)  # SIGTERM
            except Exception:
                pass
            self.pid = None
