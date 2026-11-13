"""Pruebas del importador/validador de geodatos y de los escenarios Huachi.

El fixture es SINTÉTICO y está etiquetado como TEST: no representa calles
reales de Ambato. Verifica el contrato geográfico propuesto (GeoJSON RFC 7946
+ semilla experimental) y su conversión al optimizador existente.
"""

import json
from pathlib import Path

import pytest

from app.geodata import (
    GeodataValidationError,
    build_scenario,
    load_network,
    load_seed,
)
from app.services.optimizer_service import optimize

FIXTURES = Path(__file__).parent / "fixtures"


def _load(name: str):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


@pytest.fixture
def network():
    net, _ = load_network(
        _load("huachi_test_nodes.geojson"), _load("huachi_test_roads.geojson")
    )
    return net


@pytest.fixture
def seed(network):
    return load_seed(_load("huachi_test_seed.json"), network)


# --- Importación ---


def test_import_network(network):
    assert [n.id for n in network.nodes] == ["test-A", "test-B", "test-C"]
    assert [r.id for r in network.roads] == ["test-R1", "test-R2", "test-R3"]
    assert network.roads[0].source == "test-A"
    assert network.roads[0].target == "test-B"


def test_import_seed(seed):
    assert seed.balances == {"test-A": 100, "test-C": -100}
    assert seed.closure_road_ids == ["test-R3"]
    assert seed.limit_capacity_factor == 0.5


# --- Escenarios ---


def test_base_scenario_optimal(network, seed):
    request = build_scenario(network, seed, "base")
    result = optimize(request).model_dump()
    assert result["status"] == "optimal"
    assert result["total_cost"] == 500
    flows = {r["id"]: r["flow"] for r in result["roads"]}
    assert flows == {"test-R1": 100, "test-R2": 100, "test-R3": 0}


def test_closure_scenario_optimal(network, seed):
    request = build_scenario(network, seed, "closure")
    result = optimize(request).model_dump()
    assert result["status"] == "optimal"
    assert result["total_cost"] == 500  # R1+R2 sigue siendo factible


def test_limit_scenario_infeasible(network, seed):
    # factor 0.5 -> capacidad 50, insuficiente para oferta 100.
    request = build_scenario(network, seed, "limit")
    result = optimize(request).model_dump()
    assert result["status"] == "infeasible"


def test_conservation_and_cost(network, seed):
    request = build_scenario(network, seed, "base")
    result = optimize(request).model_dump()
    flows = {r["id"]: r["flow"] for r in result["roads"]}
    net = {n.id: 0 for n in request.nodes}
    for road in request.roads:
        flow = flows[road.id]
        assert 0 <= flow <= (road.capacity if road.enabled else 0)
        net[road.source] += flow
        net[road.target] -= flow
    assert net == {n.id: n.balance for n in request.nodes}
    assert result["total_cost"] == sum(
        flows[road.id] * road.unit_cost for road in request.roads
    )


# --- Validación ---


def test_orphan_road_rejected(network):
    roads = _load("huachi_test_roads.geojson")
    roads["features"][0]["properties"]["source"] = "test-inexistente"
    with pytest.raises(GeodataValidationError):
        load_network(_load("huachi_test_nodes.geojson"), roads)


def test_duplicate_node_id_rejected():
    nodes = _load("huachi_test_nodes.geojson")
    nodes["features"][1]["properties"]["node_id"] = "test-A"
    with pytest.raises(GeodataValidationError):
        load_network(nodes, _load("huachi_test_roads.geojson"))


def test_seed_balance_sum_rejected(network):
    seed_json = _load("huachi_test_seed.json")
    seed_json["balances"]["test-A"] = 50  # suma = -50
    with pytest.raises(GeodataValidationError):
        load_seed(seed_json, network)


def test_seed_unknown_road_rejected(network):
    seed_json = _load("huachi_test_seed.json")
    seed_json["roads"]["test-inexistente"] = {"capacity": 1, "unit_cost": 1}
    with pytest.raises(GeodataValidationError):
        load_seed(seed_json, network)


def test_seed_missing_road_rejected(network):
    seed_json = _load("huachi_test_seed.json")
    del seed_json["roads"]["test-R2"]
    with pytest.raises(GeodataValidationError):
        load_seed(seed_json, network)


def test_boolean_balance_rejected(network):
    seed_json = _load("huachi_test_seed.json")
    seed_json["balances"]["test-A"] = True
    with pytest.raises(GeodataValidationError):
        load_seed(seed_json, network)
