# Backend de SmartFlow

API REST y motor matemático (flujo de costo mínimo) de SmartFlow. Responsabilidad
de Persona 2. No editar `frontend/`.

## Requisitos

- Python 3.12.

## Instalación

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

## Ejecución

```powershell
uvicorn app.main:app --reload --port 8000
```

- API base: http://localhost:8000/api/v1
- Documentación interactiva (OpenAPI): http://localhost:8000/docs

## Pruebas

```powershell
python -m pytest
```

## Endpoints

| Método | Ruta                 | Descripción |
|--------|----------------------|-------------|
| GET    | `/api/v1/health`     | Estado del servicio (`{"status":"ok"}`). |
| POST   | `/api/v1/optimize`   | Flujo de costo mínimo de un escenario. |

No añadir endpoints nuevos sin acuerdo compartido.
