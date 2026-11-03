"""Regressions for the validated solver domain and integration origins."""

from unittest.mock import patch

import pytest

from app.optimizer.limits import MAX_SAFE_INT, unit_cost_limit
from app.optimizer.min_cost_flow import SolverDomainError, SolverError, solve_min_cost_flow


def scenario(num_nodes, cost, capacity=1, enabled=True):
    supply = 1 if enabled and capacity else 0
    return {
        "scenario_name": "numeric-domain",
        "nodes": [
            {"id": str(i), "label": str(i), "x": i, "y": 0,
             "balance": supply if i == 0 else -supply if i == 1 else 0}
            for i in range(num_nodes)
        ],
        "roads": [{"id": "R", "source": "0", "target": "1",
                   "capacity": capacity, "unit_cost": cost, "enabled": enabled}],
    }


def test_original_510_node_failure_is_rejected_before_solver(client):
    with patch("app.services.optimizer_service.solve_min_cost_flow") as solve:
        response = client.post("/api/v1/optimize", json=scenario(510, MAX_SAFE_INT))
    assert response.status_code == 422
    assert "510 nodos" in response.json()["detail"][0]["msg"]
    solve.assert_not_called()


@pytest.mark.parametrize("num_nodes", [2, 36, 510])
def test_supported_unit_cost_boundary_is_exact(client, num_nodes):
    limit = unit_cost_limit(num_nodes)
    response = client.post("/api/v1/optimize", json=scenario(num_nodes, limit))
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "optimal"
    assert data["total_cost"] == limit
    assert data["roads"][0]["flow"] == 1


@pytest.mark.parametrize("num_nodes", [2, 36, 510])
def test_above_supported_boundary_never_reaches_solver(client, num_nodes):
    with patch("app.services.optimizer_service.solve_min_cost_flow") as solve:
        response = client.post(
            "/api/v1/optimize", json=scenario(num_nodes, unit_cost_limit(num_nodes) + 1)
        )
    assert response.status_code == 422
    solve.assert_not_called()


@pytest.mark.parametrize("capacity,enabled", [(0, True), (MAX_SAFE_INT, False)])
def test_inactive_road_cost_cannot_trigger_solver_range_error(client, capacity, enabled):
    response = client.post(
        "/api/v1/optimize", json=scenario(510, MAX_SAFE_INT, capacity, enabled)
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total_cost"] == 0
    assert data["roads"] == [
        {"id": "R", "flow": 0, "capacity": 0, "utilization_pct": None}
    ]


def test_numeric_domain_error_is_422_but_unexpected_solver_error_stays_500(client):
    for error, expected in [(SolverDomainError("unsupported numeric range"), 422),
                            (SolverError("unexpected test failure"), 500)]:
        with patch("app.services.optimizer_service.solve_min_cost_flow", side_effect=error):
            response = client.post("/api/v1/optimize", json=scenario(2, 1))
        assert response.status_code == expected
        assert "status" not in response.json()


def test_solver_range_status_is_classified_even_without_request_validation():
    with pytest.raises(SolverDomainError):
        solve_min_cost_flow(510, [(0, 1, 1, MAX_SAFE_INT)], [1, -1] + [0] * 508)


@pytest.mark.parametrize("origin", ["http://localhost:5173", "http://127.0.0.1:5173",
                                   "http://localhost:4173", "http://127.0.0.1:4173"])
def test_development_and_preview_origins(client, origin):
    response = client.options("/api/v1/optimize", headers={
        "Origin": origin, "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    })
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin


def test_unapproved_origin_is_not_enabled(client):
    response = client.options("/api/v1/optimize", headers={
        "Origin": "https://unapproved.invalid", "Access-Control-Request-Method": "POST",
    })
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers
