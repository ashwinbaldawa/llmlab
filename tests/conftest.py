"""Shared fixtures for LLMLab tests."""

import pytest
from fastapi.testclient import TestClient

from llmlab.server import app


@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)
