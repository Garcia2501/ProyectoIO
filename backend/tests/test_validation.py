"""Pruebas de validación del contrato (deben devolver HTTP 422)."""

import copy

from .test_optimize import REFERENCE


def _post(client, payload):
    return client.post("/api/v1/optimize", json=payload)


def _mutate(**changes):
    scenario = copy.deepcopy(REFERENCE)
    for path, value in changes.items():
        parts = path.split(".")
        target = scenario
        for part in parts[:-1]:
            if isinstance(target, list):
                target = target[int(part)]
            else:
                target = target[part]
        if isinstance(target, list):
            target[int(parts[-1])] = value
        else:
            target[parts[-1]] = value
    return scenario


def test_invalid_balance_sum(client):
    scenario = copy.deepcopy(REFERENCE)
    scenario["nodes"][0]["balance"] = 5  # suma total = 5
    assert _post(client, scenario).status_code == 422


def test_duplicate_node_ids(client):
    scenario = copy.deepcopy(REFERENCE)
    scenario["nodes"][1]["id"] = "A"
    assert _post(client, scenario).status_code == 422


def test_duplicate_road_ids(client):
    scenario = copy.deepcopy(REFERENCE)
    scenario["roads"][1]["id"] = "R1"
    assert _post(client, scenario).status_code == 422


def test_missing_node_reference(client):
    scenario = copy.deepcopy(REFERENCE)
    scenario["roads"][0]["source"] = "Z"  # no existe
    assert _post(client, scenario).status_code == 422


def test_negative_capacity(client):
    scenario = copy.deepcopy(REFERENCE)
    scenario["roads"][0]["capacity"] = -1
    assert _post(client, scenario).status_code == 422


def test_negative_unit_cost(client):
    scenario = copy.deepcopy(REFERENCE)
    scenario["roads"][0]["unit_cost"] = -1
    assert _post(client, scenario).status_code == 422


def test_less_than_two_nodes(client):
    scenario = copy.deepcopy(REFERENCE)
    scenario["nodes"] = scenario["nodes"][:1]
    scenario["roads"] = []
    assert _post(client, scenario).status_code == 422


def test_missing_required_field(client):
    scenario = copy.deepcopy(REFERENCE)
    del scenario["nodes"]
    assert _post(client, scenario).status_code == 422


def test_blank_node_id(client):
    scenario = copy.deepcopy(REFERENCE)
    scenario["nodes"][0]["id"] = "   "
    assert _post(client, scenario).status_code == 422


def _set_node_field(scenario, field, value):
    scenario = copy.deepcopy(scenario)
    scenario["nodes"][0][field] = value
    return scenario


def _set_road_field(scenario, field, value):
    scenario = copy.deepcopy(scenario)
    scenario["roads"][0][field] = value
    return scenario


# --- Booleans deben rechazarse en los campos enteros (HTTP 422) ---


def test_boolean_balance_rejected(client):
    for value in (True, False):
        assert (
            _post(client, _set_node_field(REFERENCE, "balance", value)).status_code
            == 422
        )


def test_boolean_capacity_rejected(client):
    for value in (True, False):
        assert (
            _post(client, _set_road_field(REFERENCE, "capacity", value)).status_code
            == 422
        )


def test_boolean_unit_cost_rejected(client):
    for value in (True, False):
        assert (
            _post(client, _set_road_field(REFERENCE, "unit_cost", value)).status_code
            == 422
        )


def test_numeric_string_capacity_rejected(client):
    assert (
        _post(client, _set_road_field(REFERENCE, "capacity", "100")).status_code
        == 422
    )


def test_float_integer_field_rejected(client):
    assert (
        _post(client, _set_road_field(REFERENCE, "unit_cost", 2.0)).status_code
        == 422
    )


# --- Límites numéricos (desbordamiento) ---


def test_capacity_exceeds_int64(client):
    assert (
        _post(client, _set_road_field(REFERENCE, "capacity", 2**63)).status_code
        == 422
    )


def test_unit_cost_huge(client):
    assert (
        _post(client, _set_road_field(REFERENCE, "unit_cost", 10**100)).status_code
        == 422
    )


def test_balance_exceeds_limit(client):
    assert (
        _post(client, _set_node_field(REFERENCE, "balance", 2**53)).status_code
        == 422
    )


def test_cost_overflow_rejected(client):
    """Cada entrada cabe, pero el producto flow*unit_cost excede el límite."""
    scenario = {
        "scenario_name": "Base",
        "nodes": [
            {"id": "A", "label": "Origen", "x": 100, "y": 150, "balance": 10**10},
            {"id": "C", "label": "Destino", "x": 400, "y": 150, "balance": -(10**10)},
        ],
        "roads": [
            {
                "id": "R",
                "source": "A",
                "target": "C",
                "capacity": 10**10,
                "unit_cost": 10**10,
                "enabled": True,
            }
        ],
    }
    assert _post(client, scenario).status_code == 422


def test_total_supply_exceeds_limit(client):
    """La oferta total (suma de balances positivos) excede el límite."""
    half = 2**52
    scenario = {
        "scenario_name": "Base",
        "nodes": [
            {"id": "A", "label": "O1", "x": 0, "y": 0, "balance": half},
            {"id": "B", "label": "O2", "x": 1, "y": 1, "balance": half},
            {"id": "C", "label": "D1", "x": 2, "y": 2, "balance": -half},
            {"id": "D", "label": "D2", "x": 3, "y": 3, "balance": -half},
        ],
        "roads": [],
    }
    assert _post(client, scenario).status_code == 422


def test_large_but_valid_values_accepted(client):
    """Valores grandes dentro del rango soportado se resuelven correctamente."""
    scenario = {
        "scenario_name": "Grande",
        "nodes": [
            {"id": "A", "label": "Origen", "x": 100, "y": 150, "balance": 10**6},
            {"id": "B", "label": "Destino", "x": 400, "y": 150, "balance": -(10**6)},
        ],
        "roads": [
            {
                "id": "R",
                "source": "A",
                "target": "B",
                "capacity": 10**6,
                "unit_cost": 10**6,
                "enabled": True,
            }
        ],
    }
    response = _post(client, scenario)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "optimal"
    assert data["total_cost"] == 10**12
