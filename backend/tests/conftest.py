"""Configuración compartida de pytest."""

import sys
from pathlib import Path

# Hace importable el paquete `app` sin depender del directorio de trabajo.
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture
def client():
    """Cliente de pruebas HTTP para la aplicación FastAPI."""
    return TestClient(app)
