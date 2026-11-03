"""Rutas del contrato REST acordado.

- ``GET  /api/v1/health``   -> estado del servicio.
- ``POST /api/v1/optimize`` -> flujo de costo mínimo de un escenario.
"""

from fastapi import APIRouter, HTTPException

from app.optimizer.min_cost_flow import SolverDomainError, SolverError
from app.schemas.network import OptimizeRequest, OptimizeResponse
from app.services.optimizer_service import optimize

router = APIRouter()


@router.get("/health")
def health() -> dict:
    """Comprobación de vida del servicio."""
    return {"status": "ok"}


@router.post("/optimize", response_model=OptimizeResponse)
def optimize_endpoint(request: OptimizeRequest) -> OptimizeResponse:
    """Resuelve un escenario y devuelve la distribución de flujo óptima.

    - HTTP 200 con ``status`` "optimal" o "infeasible".
    - HTTP 422 cuando el payload no cumple el contrato (lo produce Pydantic).
    - HTTP 500 ante un error inesperado del solver (no se inventan datos).
    """
    try:
        return optimize(request)
    except SolverDomainError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except SolverError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Error inesperado del solver: {exc}",
        ) from exc
