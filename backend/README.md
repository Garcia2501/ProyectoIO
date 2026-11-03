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

## Límites numéricos

Todas las magnitudes enteras del contrato (`balance`, `capacity`, `unit_cost`,
`flow`, `total_cost`, `total_supply`) se restringen al rango de **enteros
seguros de JavaScript** (`2^53 - 1` = `9007199254740991`).

- Cada campo entero se valida con `StrictInt`: se rechazan booleanos, cadenas
  numéricas y flotantes (HTTP 422). Un `true`/`false` o un `"100"` en un campo
  entero no se convierte silenciosamente en una cantidad.
- Se valida además la **oferta total** (`suma de balances positivos`) y una
  **cota superior del costo total** (`sum(capacidad_efectiva × unit_cost)`)
  antes de invocar al solver; superarlas devuelve HTTP 422.
- El motor incluye una comprobación defensiva: si el costo reportado por
  OR-Tools no coincide con la suma exacta de `flow × unit_cost`, devuelve
  HTTP 500 en lugar de publicar un resultado `optimal` inconsistente.

Además, para N nodos se aplica a cada vía con capacidad efectiva positiva:

```text
unit_cost <= min(2^53-1, floor((2^63-2) / (2*(N+3)^2)))
```

Es un dominio conservador basado en la cota documentada por OR-Tools para
evitar desbordamientos de costos escalados y potenciales. Incluye los dos
nodos auxiliares de SimpleMinCostFlow y un margen adicional. Se rechaza con
422 antes de resolver si se supera. No se redondean ni reescalan los costos.
Las vías cerradas o con capacidad 0 conservan sus propiedades; solo su costo
interno en el solver se normaliza a 0, porque no pueden transportar flujo.
Si aun así el solver informa BAD_COST_RANGE o BAD_CAPACITY_RANGE, la API
devuelve 422; los fallos inesperados siguen devolviendo 500.

Referencia: https://github.com/google/or-tools/blob/v9.15/ortools/graph/min_cost_flow.h

Los enteros de respuesta se mantienen dentro de la precisión exacta del
frontend mediante los límites individuales, de oferta y de costo total.

## Integración local

Se permiten CORS explícitamente desde `localhost` y `127.0.0.1` en los
puertos 5173 (Vite dev) y 4173 (Vite preview). No se permite cualquier origen.

## Endpoints

| Método | Ruta                 | Descripción |
|--------|----------------------|-------------|
| GET    | `/api/v1/health`     | Estado del servicio (`{"status":"ok"}`). |
| POST   | `/api/v1/optimize`   | Flujo de costo mínimo de un escenario. |

No añadir endpoints nuevos sin acuerdo compartido.
