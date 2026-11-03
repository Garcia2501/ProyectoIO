"""Resolución del flujo de costo mínimo con Google OR-Tools.

Se usa ``SimpleMinCostFlow``, que resuelve el problema de programación lineal
de flujo de costo mínimo con capacidades enteras, flujos enteros y balances
de oferta/demanda por nodo.
"""

from typing import List, Sequence, Tuple

from ortools.graph.python import min_cost_flow

# (tail, head, capacity, unit_cost)
Arc = Tuple[int, int, int, int]


class InfeasibleError(Exception):
    """No existe flujo factible con las capacidades actuales."""


class SolverError(Exception):
    """El solver devolvió un estado distinto de óptimo/infactible."""


def solve_min_cost_flow(
    num_nodes: int,
    arcs: Sequence[Arc],
    supplies: Sequence[int],
) -> Tuple[List[int], int]:
    """Resuelve el flujo de costo mínimo.

    Devuelve ``(flujos_por_arco, costo_total)``. Lanza ``InfeasibleError``
    cuando no hay solución factible y ``SolverError`` ante cualquier otro
    estado inesperado del solver.
    """
    solver = min_cost_flow.SimpleMinCostFlow()

    tails = [arc[0] for arc in arcs]
    heads = [arc[1] for arc in arcs]
    capacities = [arc[2] for arc in arcs]
    unit_costs = [arc[3] for arc in arcs]
    solver.add_arcs_with_capacity_and_unit_cost(
        tails, heads, capacities, unit_costs
    )

    solver.set_nodes_supplies(list(range(num_nodes)), list(supplies))

    status = solver.solve()

    if status == solver.OPTIMAL:
        flows = [int(solver.flow(i)) for i in range(len(arcs))]
        return flows, int(solver.optimal_cost())

    if status == solver.INFEASIBLE:
        raise InfeasibleError()

    raise SolverError(f"el solver devolvió el estado {status}")
