"""Punto de entrada de la API REST de SmartFlow.

Arranca con::

    uvicorn app.main:app --reload --port 8000

La documentación interactiva queda en http://localhost:8000/docs.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router

app = FastAPI(
    title="SmartFlow API",
    version="1.0.0",
    description=(
        "Backend de optimización de flujo de costo mínimo para SmartFlow. "
        "Modela una red vial como un grafo dirigido con capacidades y balances "
        "de oferta/demanda."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")
