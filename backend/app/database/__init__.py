"""Persistencia SQLite de SmartFlow (redes, escenarios, ejecuciones y flujos).

Capas de datos con SQLAlchemy 2 + SQLite, según el apartado D del plan V2.0.
Los endpoints que expongan esta persistencia se coordinan por separado.
"""

from app.database.models import (
    Base,
    Change,
    Execution,
    FlowResult,
    Network,
    Node,
    Road,
    Scenario,
)
from app.database.repository import (
    get_execution,
    get_network,
    get_seed,
    make_engine,
    record_change,
    save_execution,
    save_network,
    save_scenario,
)

__all__ = [
    "Base",
    "Change",
    "Execution",
    "FlowResult",
    "Network",
    "Node",
    "Road",
    "Scenario",
    "get_execution",
    "get_network",
    "get_seed",
    "make_engine",
    "record_change",
    "save_execution",
    "save_network",
    "save_scenario",
]
