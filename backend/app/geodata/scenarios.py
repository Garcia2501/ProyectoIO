"""Construcción de los escenarios experimentales de Huachi.

Combina el ``GeoNetwork`` (geografía, de GIS) con el ``ScenarioSeed``
(parámetros experimentales) para producir el contrato de optimización heredado
``OptimizeRequest``. Los tres escenarios comparten nodos y balances:

- ``base``: todas las vías habilitadas con sus capacidades y costos.
- ``closure``: se deshabilitan las vías de ``closure_road_ids``.
- ``limit``: las capacidades se reducen con ``limit_capacity_factor`` (lleva a
  capacidad 0 cuando el factor es suficientemente pequeño -> infeasible).

Las coordenadas ``x``/``y`` son de lienzo (proyección local), NO latitud/
longitud; la geometría real no interviene en el cálculo.
"""

import math
from typing import Dict, Literal, Tuple

from app.geodata.models import GeoNetwork, ScenarioSeed
from app.schemas.network import OptimizeRequest

ScenarioVariant = Literal["base", "closure", "limit"]

_VARIANTS: Tuple[ScenarioVariant, ...] = ("base", "closure", "limit")


def canvas_positions(network: GeoNetwork) -> Dict[str, Tuple[float, float]]:
    """Proyección equirectangular local de lon/lat a coordenadas de lienzo.

    Igual criterio que el frontend: solo ubica visualmente, no afecta la
    optimización.
    """
    lat0 = sum(n.lat for n in network.nodes) / len(network.nodes)
    k = math.cos(math.radians(lat0))
    raw = [(n.lon * k, -n.lat) for n in network.nodes]
    min_x = min(p[0] for p in raw)
    min_y = min(p[1] for p in raw)
    span = max(
        1e-9,
        max(p[0] for p in raw) - min_x,
        max(p[1] for p in raw) - min_y,
    )
    scale = 900.0 / span
    return {
        n.id: (
            round(80 + (p[0] - min_x) * scale),
            round(80 + (p[1] - min_y) * scale),
        )
        for n, p in zip(network.nodes, raw)
    }


def build_scenario(
    network: GeoNetwork,
    seed: ScenarioSeed,
    variant: ScenarioVariant,
) -> OptimizeRequest:
    """Construye el ``OptimizeRequest`` de uno de los tres escenarios."""
    if variant not in _VARIANTS:
        raise ValueError(f"variante desconocida: {variant}")

    positions = canvas_positions(network)
    closed = set(seed.closure_road_ids)

    nodes = [
        {
            "id": n.id,
            "label": n.label,
            "x": positions[n.id][0],
            "y": positions[n.id][1],
            "balance": seed.balances.get(n.id, 0),
        }
        for n in network.nodes
    ]
    roads = []
    for r in network.roads:
        sr = seed.roads[r.id]
        enabled = sr.enabled
        capacity = sr.capacity
        if variant == "closure":
            enabled = enabled and r.id not in closed
        elif variant == "limit":
            capacity = int(capacity * seed.limit_capacity_factor)
        roads.append(
            {
                "id": r.id,
                "source": r.source,
                "target": r.target,
                "capacity": capacity,
                "unit_cost": sr.unit_cost,
                "enabled": enabled,
            }
        )

    return OptimizeRequest(scenario_name=variant, nodes=nodes, roads=roads)
