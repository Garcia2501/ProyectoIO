"""Orquestación: traduce el escenario al solver y construye la respuesta."""

from app.optimizer.min_cost_flow import (
    InfeasibleError,
    solve_min_cost_flow,
)
from app.schemas.network import OptimizeRequest, OptimizeResponse, RoadResult


def optimize(request: OptimizeRequest) -> OptimizeResponse:
    """Resuelve un escenario y devuelve la respuesta del contrato REST.

    La ``capacity`` devuelta es la efectiva (0 cuando ``enabled`` es False) y
    ``utilization_pct`` es ``None`` cuando la capacidad efectiva es 0.
    """
    node_index = {node.id: i for i, node in enumerate(request.nodes)}

    arcs = []
    for road in request.roads:
        tail = node_index[road.source]
        head = node_index[road.target]
        effective_capacity = road.capacity if road.enabled else 0
        arcs.append((tail, head, effective_capacity, road.unit_cost))

    supplies = [node.balance for node in request.nodes]

    total_supply = sum(max(0, node.balance) for node in request.nodes)

    try:
        flows, total_cost = solve_min_cost_flow(
            len(request.nodes), arcs, supplies
        )
    except InfeasibleError:
        return OptimizeResponse(
            status="infeasible",
            scenario_name=request.scenario_name,
            total_cost=None,
            total_supply=total_supply,
            roads=[],
            message="No existe flujo factible con las capacidades actuales",
        )

    roads_result = []
    for index, road in enumerate(request.roads):
        effective_capacity = arcs[index][2]
        flow = flows[index]
        utilization_pct = (
            round(flow * 100.0 / effective_capacity, 6)
            if effective_capacity > 0
            else None
        )
        roads_result.append(
            RoadResult(
                id=road.id,
                flow=flow,
                capacity=effective_capacity,
                utilization_pct=utilization_pct,
            )
        )

    return OptimizeResponse(
        status="optimal",
        scenario_name=request.scenario_name,
        total_cost=total_cost,
        total_supply=total_supply,
        roads=roads_result,
    )
