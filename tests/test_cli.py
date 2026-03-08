"""Tests for llmlab.cli module."""

from unittest.mock import patch, MagicMock
import sys

import pytest


class TestCLI:
    @patch("uvicorn.run")
    @patch("webbrowser.open")
    @patch("threading.Timer")
    def test_default_args(self, mock_timer, mock_wb_open, mock_uv_run, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["llmlab"])
        from llmlab.cli import main
        main()
        mock_uv_run.assert_called_once_with(
            "llmlab.server:app",
            host="127.0.0.1",
            port=8000,
            log_level="warning",
        )

    @patch("uvicorn.run")
    @patch("webbrowser.open")
    @patch("threading.Timer")
    def test_custom_port_host(self, mock_timer, mock_wb_open, mock_uv_run, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["llmlab", "--port", "9000", "--host", "0.0.0.0"])
        from llmlab.cli import main
        main()
        mock_uv_run.assert_called_once_with(
            "llmlab.server:app",
            host="0.0.0.0",
            port=9000,
            log_level="warning",
        )

    @patch("uvicorn.run")
    @patch("webbrowser.open")
    @patch("threading.Timer")
    def test_no_browser_flag(self, mock_timer, mock_wb_open, mock_uv_run, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["llmlab", "--no-browser"])
        from llmlab.cli import main
        main()
        mock_timer.assert_not_called()

    @patch("uvicorn.run")
    @patch("webbrowser.open")
    @patch("threading.Timer")
    def test_browser_opens_by_default(self, mock_timer, mock_wb_open, mock_uv_run, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["llmlab"])
        from llmlab.cli import main
        main()
        mock_timer.assert_called_once()
        # Verify it was set up to call webbrowser.open after 1.5s
        args, kwargs = mock_timer.call_args
        assert args[0] == 1.5
