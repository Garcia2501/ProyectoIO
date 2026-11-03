"""Pruebas del endpoint /api/v1/optimize con el escenario de referencia."""

REFERENCE = {
    "scenario_name": "Base",
    "nodes": [
        {"id": "A", "label": "Origen", "x": 100, "y": 150, "balance": 100},
        {"id": "B", "label": "Intermedio", "x": 250, "y": 150, "balance": 0},
        {"id": "C", "label": "Destino", "x": 400, "y": 150, "balance": -100},
    ],
    "roads": [
        {"id": "R1", "source": "A", "target": "B", "capacity": 100, "unit_cost": 2, "enabled": True},
        {"id": "R2", "source": "B", "target": "C", "capacity": 100, "unit_cost": 3, "enabled": True},
        {"id": "R3", "source": "A", "target": "C", "capacity": 50, "unit_cost": 8, "enabled": True},
    ],
}


def _disable_road(scenario, road_id):
    scenario = {
        "scenario_name": scenario["scenario_name"],
        "nodes": [dict(n) for n in scenario["nodes"]],
        "roads": [
            {**r, "enabled": False} if r["id"] == road_id else dict(r)
            for r in scenario["roads"]
        ],
    }
    return scenario


def _set_balances(scenario, balances):
    scenario = {
        "scenario_name": scenario["scenario_name"],
        "nodes": [
            {**n, "balance": balances.get(n["id"], n["balance"])}
            for n in scenario["nodes"]
        ],
        "roads": [dict(r) for r in scenario["roads"]],
    }
    return scenario


def test_reference_scenario_optimal(client):
    response = client.post("/api/v1/optimize", json=REFERENCE)
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "optimal"
    assert data["scenario_name"] == "Base"
    assert data["total_cost"] == 500
    assert data["total_supply"] == 100

    # El orden debe seguir al de la solicitud.
    assert [r["id"] for r in data["roads"]] == ["R1", "R2", "R3"]

    flows = {r["id"]: r["flow"] for r in data["roads"]}
    assert flows == {"R1": 100, "R2": 100, "R3": 0}

    caps = {r["id"]: r["capacity"] for r in data["roads"]}
    assert caps == {"R1": 100, "R2": 100, "R3": 50}

    utils = {r["id"]: r["utilization_pct"] for r in data["roads"]}
    assert utils["R1"] == 100.0
    assert utils["R2"] == 100.0
    assert utils["R3"] == 0.0


def test_total_cost_matches_unit_costs(client):
    """El costo total debe ser la suma de flujo * unit_cost por vía."""
    data = client.post("/api/v1/optimize", json=REFERENCE).json()
    flows = {r["id"]: r["flow"] for r in data["roads"]}
    expected = sum(
        r["unit_cost"] * flows[r["id"]] for r in REFERENCE["roads"]
    )
    assert data["total_cost"] == expected


def test_flow_conservation(client):
    """Salidas - entradas de cada nodo deben igualar su balance."""
    data = client.post("/api/v1/optimize", json=REFERENCE).json()
    flows = {r["id"]: r["flow"] for r in data["roads"]}
    for node in REFERENCE["nodes"]:
        outflow = sum(
            flows[r["id"]]
            for r in REFERENCE["roads"]
            if r["source"] == node["id"]
        )
        inflow = sum(
            flows[r["id"]]
            for r in REFERENCE["roads"]
            if r["target"] == node["id"]
        )
        assert outflow - inflow == node["balance"]


def test_no_road_exceeds_capacity(client):
    data = client.post("/api/v1/optimize", json=REFERENCE).json()
    for result, road in zip(data["roads"], REFERENCE["roads"]):
        assert 0 <= result["flow"] <= road["capacity"]


def test_disabled_road_has_null_utilization(client):
    """Una vía deshabilitada: capacidad 0, flujo 0, utilización None."""
    scenario = _disable_road(REFERENCE, "R3")
    data = client.post("/api/v1/optimize", json=scenario).json()

    assert data["status"] == "optimal"
    assert data["total_cost"] == 500

    by_id = {r["id"]: r for r in data["roads"]}
    r3 = by_id["R3"]
    assert r3["flow"] == 0
    assert r3["capacity"] == 0
    assert r3["utilization_pct"] is None


def test_closed_road_with_alternative_feasible(client):
    """Cerrar R1 y reducir oferta/demanda a 50: ruta directa costo 400."""
    scenario = _disable_road(REFERENCE, "R1")
    scenario = _set_balances(scenario, {"A": 50, "C": -50})
    data = client.post("/api/v1/optimize", json=scenario).json()

    assert data["status"] == "optimal"
    assert data["total_cost"] == 400  # 50 * 8
    by_id = {r["id"]: r for r in data["roads"]}
    assert by_id["R3"]["flow"] == 50


def test_closed_road_without_alternative_infeasible(client):
    """Cerrar R1 con oferta 100 y R3 limitada a 50: no hay flujo factible."""
    scenario = _disable_road(REFERENCE, "R1")
    response = client.post("/api/v1/optimize", json=scenario)

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "infeasible"
    assert data["scenario_name"] == "Base"
    assert data["total_cost"] is None
    assert data["total_supply"] == 100
    assert data["roads"] == []
    assert data["message"] == (
        "No existe flujo factible con las capacidades actuales"
    )
