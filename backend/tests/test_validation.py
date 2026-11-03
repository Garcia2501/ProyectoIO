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
