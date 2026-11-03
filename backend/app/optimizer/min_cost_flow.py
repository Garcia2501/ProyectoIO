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


class SolverDomainError(SolverError):
    """El modelo excede el dominio numérico soportado por el solver."""


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
    # Zero-capacity arcs cannot contribute to the objective. Normalizing only
    # their internal costs avoids spurious cost-range failures on closed roads.
    # The request and the order/capacity of response roads stay unchanged.
    unit_costs = [arc[3] if arc[2] > 0 else 0 for arc in arcs]
    solver.add_arcs_with_capacity_and_unit_cost(
        tails, heads, capacities, unit_costs
    )

    solver.set_nodes_supplies(list(range(num_nodes)), list(supplies))

    status = solver.solve()

    if status == solver.OPTIMAL:
        flows = [int(solver.flow(i)) for i in range(len(arcs))]
        reported_cost = int(solver.optimal_cost())
        # Comprobación defensiva: el costo reportado debe coincidir con la
        # suma exacta de flujo * unit_cost. Evita publicar un "optimal" con
        # costo inconsistente si el solver desbordara sus enteros de 64 bits.
        computed_cost = sum(
            flow * unit_cost for flow, unit_cost in zip(flows, unit_costs)
        )
        if reported_cost != computed_cost:
            raise SolverError(
                "el costo del solver no coincide con los flujos obtenidos"
            )
        return flows, reported_cost

    if status == solver.INFEASIBLE:
        raise InfeasibleError()

    if status in (solver.BAD_COST_RANGE, solver.BAD_CAPACITY_RANGE):
        raise SolverDomainError(
            "la combinación de costos, capacidades y tamaño de red excede "
            "el rango numérico soportado; reduce estas magnitudes"
        )

    raise SolverError(f"el solver devolvió el estado {status}")
