"""Importador y validador de geodatos (GeoJSON) y de la semilla de escenario.

Convierte el dataset geográfico aprobado por el equipo GIS en un ``GeoNetwork``
(nodos y arcos dirigidos) y la semilla en un ``ScenarioSeed``. Valida antes de
aceptar cualquier dato:

- ``FeatureCollection`` GeoJSON (RFC 7946), nodos ``Point`` y vías ``LineString``.
- IDs únicos y no vacíos; arcos sin nodos huérfanos (``source``/``target``
  deben existir en ``huachi_nodes.geojson``).
- Extremos de línea coherentes con la posición del nodo (tolerancia en metros).
- Semilla: ``sum(balances) == 0``, nodos/vías referenciados existentes, todas
  las vías con capacidad/costo, cierres válidos y factor ``0 < f < 1``.

No atribuye capacidades ni sentidos a fuentes sin evidencia: si un dato no está
confirmado se conserva su marca (``verified``, ``assumptions``) sin inventar.
"""

import math
from typing import Dict, List, Optional, Sequence, Tuple

from app.geodata.models import (
    GeoNetwork,
    GeoNode,
    GeoRoad,
    ScenarioSeed,
    SeedRoad,
)

# Tolerancia (m) entre un extremo de línea y su nodo, a acordar con GIS.
DEFAULT_ENDPOINT_TOLERANCE_M = 25.0

_EARTH_RADIUS_M = 6371008.8


class GeodataValidationError(Exception):
    """Errores de validación de geodatos o de la semilla."""

    def __init__(self, errors: Sequence[str]):
        self.errors = list(errors)
        super().__init__("; ".join(self.errors))


def haversine_m(a: Sequence[float], b: Sequence[float]) -> float:
    """Distancia geodésica (haversine) en metros entre dos puntos [lon, lat]."""
    lon1, lat1 = float(a[0]), float(a[1])
    lon2, lat2 = float(b[0]), float(b[1])
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    h = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(
        dlmb / 2
    ) ** 2
    return 2 * _EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(h)))


def _is_record(value) -> bool:
    return isinstance(value, dict)


def _is_lon_lat(value) -> bool:
    return (
        isinstance(value, (list, tuple))
        and len(value) >= 2
        and all(isinstance(c, (int, float)) and math.isfinite(c) for c in value[:2])
        and abs(value[0]) <= 180
        and abs(value[1]) <= 90
    )


def _text(value) -> Optional[str]:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _features(json_obj, label: str, errors: List[str]) -> List[dict]:
    if not _is_record(json_obj) or json_obj.get("type") != "FeatureCollection":
        errors.append(f"{label}: debe ser un FeatureCollection GeoJSON.")
        return []
    features = json_obj.get("features")
    if not isinstance(features, list):
        errors.append(f'{label}: falta la lista "features".')
        return []
    return [f for f in features if _is_record(f)]


def _parse_nodes(json_obj, errors: List[str]) -> List[GeoNode]:
    nodes: List[GeoNode] = []
    seen: set[str] = set()
    for i, feature in enumerate(_features(json_obj, "huachi_nodes.geojson", errors)):
        where = f"huachi_nodes.geojson #{i + 1}"
        geometry = feature.get("geometry")
        props = feature.get("properties") if _is_record(feature.get("properties")) else {}
        node_id = _text(props.get("node_id"))
        if not _is_record(geometry) or geometry.get("type") != "Point":
            errors.append(f"{where}: la geometría debe ser Point.")
            continue
        coords = geometry.get("coordinates")
        if not _is_lon_lat(coords):
            errors.append(f"{where}: coordenadas [longitud, latitud] inválidas.")
            continue
        if not node_id:
            errors.append(f"{where}: falta properties.node_id.")
            continue
        if node_id in seen:
            errors.append(f'{where}: node_id "{node_id}" duplicado.')
            continue
        seen.add(node_id)
        nodes.append(
            GeoNode(
                id=node_id,
                label=_text(props.get("label")) or node_id,
                lon=float(coords[0]),
                lat=float(coords[1]),
                kind=_text(props.get("node_kind")),
            )
        )
    return nodes


def _parse_roads(
    json_obj,
    nodes_by_id: Dict[str, GeoNode],
    errors: List[str],
    warnings: List[str],
    tolerance_m: float,
) -> List[GeoRoad]:
    roads: List[GeoRoad] = []
    seen: set[str] = set()
    # Detección de arcos paralelos (mismo source->target): permitidos pero se
    # informa, porque no deben confundirse con IDs duplicados.
    pairs: Dict[Tuple[str, str], List[str]] = {}
    for i, feature in enumerate(_features(json_obj, "huachi_roads.geojson", errors)):
        where = f"huachi_roads.geojson #{i + 1}"
        geometry = feature.get("geometry")
        props = feature.get("properties") if _is_record(feature.get("properties")) else {}
        road_id = _text(props.get("road_id"))
        source = _text(props.get("source"))
        target = _text(props.get("target"))
        if not _is_record(geometry) or geometry.get("type") != "LineString":
            errors.append(f"{where}: la geometría debe ser LineString.")
            continue
        line = geometry.get("coordinates")
        if not isinstance(line, list) or len(line) < 2 or not all(_is_lon_lat(c) for c in line):
            errors.append(f"{where}: la línea necesita al menos dos coordenadas válidas.")
            continue
        if not road_id:
            errors.append(f"{where}: falta properties.road_id.")
            continue
        if road_id in seen:
            errors.append(f'{where}: road_id "{road_id}" duplicado.')
            continue
        seen.add(road_id)
        if not source or not target:
            errors.append(f"{where} ({road_id}): faltan source o target.")
            continue
        if source not in nodes_by_id or target not in nodes_by_id:
            missing = source if source not in nodes_by_id else target
            errors.append(
                f"{where} ({road_id}): arco huérfano; el nodo {missing} no existe."
            )
            continue
        oneway = props.get("oneway")
        if oneway not in (True, False, "unknown"):
            oneway = "unknown"
        # Coherencia geométrica de extremos (warning, no bloqueante).
        src_node = nodes_by_id[source]
        tgt_node = nodes_by_id[target]
        start, end = line[0], line[-1]
        start_gap = haversine_m(start, [src_node.lon, src_node.lat])
        end_gap = haversine_m(end, [tgt_node.lon, tgt_node.lat])
        if max(start_gap, end_gap) > tolerance_m:
            warnings.append(
                f"{road_id}: un extremo queda a "
                f"{round(max(start_gap, end_gap))} m de su nodo "
                f"(tolerancia {tolerance_m} m)."
            )
        pairs.setdefault((source, target), []).append(road_id)
        roads.append(
            GeoRoad(
                id=road_id,
                source=source,
                target=target,
                name=_text(props.get("name")),
                oneway=oneway,
                source_quality=_text(props.get("source_quality")) or "sin dato",
                verified=props.get("verified") is True,
                osm_way_ids=[
                    str(x) for x in props.get("osm_way_ids", [])
                    if isinstance(props.get("osm_way_ids"), list)
                ]
                if isinstance(props.get("osm_way_ids"), list)
                else [],
                length_m=props.get("length_m")
                if isinstance(props.get("length_m"), (int, float))
                else None,
                assumptions=_text(props.get("assumptions")),
            )
        )
    for (source, target), ids in pairs.items():
        if len(ids) > 1:
            warnings.append(
                f"arcos paralelos {source}->{target}: {', '.join(ids)}"
            )
    return roads


def load_network(
    nodes_json, roads_json, tolerance_m: float = DEFAULT_ENDPOINT_TOLERANCE_M
) -> Tuple[GeoNetwork, List[str]]:
    """Valida y combina nodos + vías en un ``GeoNetwork``.

    Lanza ``GeodataValidationError`` si hay errores. Devuelve también la lista
    de advertencias (no bloqueantes).
    """
    errors: List[str] = []
    warnings: List[str] = []
    nodes = _parse_nodes(nodes_json, errors)
    by_id = {n.id: n for n in nodes}
    roads = _parse_roads(roads_json, by_id, errors, warnings, tolerance_m)
    if errors:
        raise GeodataValidationError(errors)
    if not nodes:
        raise GeodataValidationError(["el dataset no tiene nodos."])
    if not roads:
        raise GeodataValidationError(["el dataset no tiene vías."])
    return GeoNetwork(nodes=nodes, roads=roads), warnings


def load_seed(seed_json, network: GeoNetwork) -> ScenarioSeed:
    """Valida la semilla experimental contra la red y devuelve ``ScenarioSeed``."""
    errors: List[str] = []
    if not _is_record(seed_json):
        raise GeodataValidationError(["huachi_scenario_seed.json: objeto inválido."])

    node_ids = {n.id for n in network.nodes}
    road_ids = {r.id for r in network.roads}

    balances: Dict[str, int] = {}
    raw_balances = seed_json.get("balances")
    if not _is_record(raw_balances):
        errors.append('Falta "balances".')
    else:
        for node_id, value in raw_balances.items():
            if node_id not in node_ids:
                errors.append(f"balances: el nodo {node_id} no existe.")
            elif not isinstance(value, int) or isinstance(value, bool):
                errors.append(f"balances.{node_id}: debe ser un entero.")
            else:
                balances[node_id] = value
    if balances and sum(balances.values()) != 0:
        errors.append(f"Los balances deben sumar 0 (suman {sum(balances.values())}).")

    roads: Dict[str, SeedRoad] = {}
    raw_roads = seed_json.get("roads")
    if not _is_record(raw_roads):
        errors.append('Falta "roads".')
    else:
        for road_id, value in raw_roads.items():
            if road_id not in road_ids:
                errors.append(f"roads: la vía {road_id} no existe.")
                continue
            if not _is_record(value):
                errors.append(f"roads.{road_id}: debe ser un objeto.")
                continue
            capacity = value.get("capacity")
            unit_cost = value.get("unit_cost")
            if (
                not isinstance(capacity, int)
                or isinstance(capacity, bool)
                or capacity < 0
            ):
                errors.append(f"roads.{road_id}.capacity: entero no negativo.")
            if (
                not isinstance(unit_cost, int)
                or isinstance(unit_cost, bool)
                or unit_cost < 0
            ):
                errors.append(f"roads.{road_id}.unit_cost: entero no negativo.")
            else:
                roads[road_id] = SeedRoad(
                    capacity=capacity,
                    unit_cost=unit_cost,
                    enabled=value.get("enabled", True) is not False,
                )
        missing = [rid for rid in road_ids if rid not in roads]
        if not errors and missing:
            errors.append(
                f"Faltan capacidad y costo para {len(missing)} vía(s): "
                f"{', '.join(missing[:5])}"
                + ("…" if len(missing) > 5 else "")
            )

    closure = seed_json.get("closure_road_ids", [])
    closure_ids: List[str] = []
    if isinstance(closure, list):
        for cid in closure:
            cid = str(cid)
            if cid not in road_ids:
                errors.append(f"closure_road_ids: la vía {cid} no existe.")
            else:
                closure_ids.append(cid)
    elif closure is not None:
        errors.append('"closure_road_ids" debe ser una lista.')

    factor = seed_json.get("limit_capacity_factor", 0.5)
    if not isinstance(factor, (int, float)) or isinstance(factor, bool) or not (0 < factor < 1):
        errors.append('"limit_capacity_factor" debe ser un número entre 0 y 1.')
        factor = 0.5

    if errors:
        raise GeodataValidationError(errors)
    return ScenarioSeed(
        balances=balances,
        roads=roads,
        closure_road_ids=closure_ids,
        limit_capacity_factor=float(factor),
    )
