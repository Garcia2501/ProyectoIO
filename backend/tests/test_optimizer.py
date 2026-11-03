"""Pruebas unitarias del motor de flujo de costo mínimo y la conservación."""

from app.optimizer.min_cost_flow import InfeasibleError, solve_min_cost_flow


def test_reference_via_engine():
    # Nodos: A=0, B=1, C=2
    arcs = [
        (0, 1, 100, 2),  # R1 A->B
        (1, 2, 100, 3),  # R2 B->C
        (0, 2, 50, 8),   # R3 A->C
    ]
    supplies = [100, 0, -100]
    flows, cost = solve_min_cost_flow(3, arcs, supplies)

    assert flows == [100, 100, 0]
    assert cost == 500


def test_infeasible_engine():
    # Oferta de 100 frente a una única vía con capacidad 50: no factible.
    arcs = [
        (0, 1, 50, 2),
    ]
    supplies = [100, -100]
    try:
        solve_min_cost_flow(2, arcs, supplies)
    except InfeasibleError:
        return
    raise AssertionError("se esperaba InfeasibleError")


def test_multiple_sources_and_sinks():
    # Dos orígenes y dos destinos; el solver debe satisfacer todos los balances.
    arcs = [
        (0, 2, 50, 1),
        (0, 3, 50, 4),
        (1, 2, 50, 2),
        (1, 3, 50, 3),
    ]
    supplies = [50, 50, -50, -50]
    flows, cost = solve_min_cost_flow(4, arcs, supplies)

    # Conservación por nodo: salidas - entradas == balance.
    balances = [0, 0, 0, 0]
    for (tail, head, _cap, _cost), flow in zip(arcs, flows):
        balances[tail] += flow
        balances[head] -= flow
    assert balances == supplies

    # Costo mínimo: 0->2 (50*1=50) + 1->3 (50*3=150) = 200.
    assert cost == 200
