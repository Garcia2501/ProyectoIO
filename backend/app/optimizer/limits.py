"""Conservative integer domain shared by request validation and the solver.

OR-Tools 9.15 documents an overflow-safe unit-cost bound below
INT64_MAX / (2 * n**2), accounting for node potentials as well as scaling.
SimpleMinCostFlow augments the requested graph with a source and a sink.
We reserve one additional node in the bound and use integer arithmetic.
https://github.com/google/or-tools/blob/v9.15/ortools/graph/min_cost_flow.h
"""

MAX_SAFE_INT = 2**53 - 1
MAX_INT64 = 2**63 - 1


def unit_cost_limit(num_nodes: int) -> int:
    """Supported positive-capacity arc cost for a requested graph size."""
    augmented_size_with_margin = num_nodes + 3
    return min(
        MAX_SAFE_INT,
        (MAX_INT64 - 1) // (2 * augmented_size_with_margin**2),
    )
