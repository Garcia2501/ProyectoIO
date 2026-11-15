"""Repositorio: persistencia y recuperación de redes, escenarios y ejecuciones.

Capa fina sobre SQLAlchemy 2. Las funciones toman una ``Session`` y devuelven
los identificadores autogenerados; las funciones ``get_*`` reconstruyen los
modelos de dominio (``GeoNetwork``, ``ScenarioSeed``, ``OptimizeResponse``) a
partir de la base de datos.
"""

from typing import Optional

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

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
from app.geodata.models import GeoNetwork, GeoNode, GeoRoad, ScenarioSeed, SeedRoad
from app.schemas.network import OptimizeResponse, RoadResult


def make_engine(url: str = "sqlite:///:memory:"):
    """Crea un motor y las tablas. ``sqlite:///:memory:`` para pruebas."""
    engine = create_engine(url, future=True)
    Base.metadata.create_all(engine)
    return engine


def _oneway_to_str(oneway) -> str:
    if oneway is True:
        return "true"
    if oneway is False:
        return "false"
    return "unknown"


def _oneway_from_str(value: str):
    if value == "true":
        return True
    if value == "false":
        return False
    return "unknown"


def save_network(
    session: Session, network: GeoNetwork, name: str, dataset_version: str = "1"
) -> int:
    """Persiste una red geográfica versionada y devuelve su id."""
    db = Network(name=name, dataset_version=dataset_version)
    session.add(db)
    session.flush()
    for n in network.nodes:
        session.add(
            Node(
                network_id=db.id,
                node_id=n.id,
                label=n.label,
                lon=n.lon,
                lat=n.lat,
                node_kind=n.kind,
            )
        )
    for r in network.roads:
        session.add(
            Road(
                network_id=db.id,
                road_id=r.id,
                source=r.source,
                target=r.target,
                name=r.name,
                oneway=_oneway_to_str(r.oneway),
                source_quality=r.source_quality,
                verified=r.verified,
                length_m=r.length_m,
                osm_way_ids=list(r.osm_way_ids or []),
                assumptions=r.assumptions,
            )
        )
    session.commit()
    return db.id


def save_scenario(
    session: Session,
    network_id: int,
    seed: ScenarioSeed,
    name: str,
    version: str = "1",
    assumptions: Optional[str] = None,
) -> int:
    """Persiste un escenario experimental y devuelve su id."""
    db = Scenario(
        network_id=network_id,
        name=name,
        version=version,
        balances=dict(seed.balances),
        roads={
            rid: {"capacity": r.capacity, "unit_cost": r.unit_cost, "enabled": r.enabled}
            for rid, r in seed.roads.items()
        },
        closure_road_ids=list(seed.closure_road_ids),
        limit_capacity_factor=seed.limit_capacity_factor,
        assumptions=assumptions,
    )
    session.add(db)
    session.commit()
    return db.id


def record_change(session: Session, scenario_id: int, description: str) -> int:
    """Registra un cambio sobre un escenario y devuelve su id."""
    db = Change(scenario_id=scenario_id, description=description)
    session.add(db)
    session.commit()
    return db.id


def save_execution(
    session: Session, scenario_id: int, result: OptimizeResponse
) -> int:
    """Persiste una ejecución y sus resultados de flujo; devuelve el id."""
    db = Execution(
        scenario_id=scenario_id,
        status=result.status,
        total_cost=result.total_cost,
        total_supply=result.total_supply,
        message=result.message,
    )
    session.add(db)
    session.flush()
    for r in result.roads:
        session.add(
            FlowResult(
                execution_id=db.id,
                road_id=r.id,
                flow=r.flow,
                capacity=r.capacity,
                utilization_pct=r.utilization_pct,
            )
        )
    session.commit()
    return db.id


# --- Recuperación ---


def get_network(session: Session, network_id: int) -> GeoNetwork:
    """Reconstruye un ``GeoNetwork`` desde la base de datos."""
    db = session.get(Network, network_id)
    if db is None:
        raise KeyError(f"red {network_id} no existe")
    nodes = [
        GeoNode(id=n.node_id, label=n.label, lon=n.lon, lat=n.lat, kind=n.node_kind)
        for n in sorted(db.nodes, key=lambda n: n.id)
    ]
    roads = [
        GeoRoad(
            id=r.road_id,
            source=r.source,
            target=r.target,
            name=r.name,
            oneway=_oneway_from_str(r.oneway),
            source_quality=r.source_quality,
            verified=r.verified,
            osm_way_ids=list(r.osm_way_ids or []),
            length_m=r.length_m,
            assumptions=r.assumptions,
        )
        for r in sorted(db.roads, key=lambda r: r.id)
    ]
    return GeoNetwork(nodes=nodes, roads=roads)


def get_seed(session: Session, scenario_id: int) -> ScenarioSeed:
    """Reconstruye un ``ScenarioSeed`` desde la base de datos."""
    db = session.get(Scenario, scenario_id)
    if db is None:
        raise KeyError(f"escenario {scenario_id} no existe")
    roads = {
        rid: SeedRoad(
            capacity=v["capacity"], unit_cost=v["unit_cost"], enabled=v["enabled"]
        )
        for rid, v in db.roads.items()
    }
    return ScenarioSeed(
        balances=dict(db.balances),
        roads=roads,
        closure_road_ids=list(db.closure_road_ids or []),
        limit_capacity_factor=db.limit_capacity_factor,
    )


def get_execution(session: Session, execution_id: int) -> OptimizeResponse:
    """Reconstruye un ``OptimizeResponse`` (con sus vías) desde la base."""
    db = session.get(Execution, execution_id)
    if db is None:
        raise KeyError(f"ejecución {execution_id} no existe")
    roads = [
        RoadResult(
            id=r.road_id,
            flow=r.flow,
            capacity=r.capacity,
            utilization_pct=r.utilization_pct,
        )
        for r in sorted(db.results, key=lambda r: r.id)
    ]
    return OptimizeResponse(
        status=db.status,
        scenario_name=db.scenario.name,
        total_cost=db.total_cost,
        total_supply=db.total_supply,
        roads=roads,
        message=db.message,
    )
