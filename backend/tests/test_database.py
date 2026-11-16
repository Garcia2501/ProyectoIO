"""Pruebas de persistencia SQLite (redes, escenarios, ejecuciones y flujos)."""

import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.database import (
    get_execution,
    get_network,
    get_seed,
    make_engine,
    record_change,
    save_execution,
    save_network,
    save_scenario,
)
from app.database.models import Scenario
from app.geodata import build_scenario, load_network, load_seed
from app.services.optimizer_service import optimize

FIXTURES = Path(__file__).parent / "fixtures"


def _load(name: str):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def _setup(session: Session):
    """Persiste red + escenario a partir del fixture y devuelve los objetos."""
    net, _ = load_network(
        _load("huachi_test_nodes.geojson"), _load("huachi_test_roads.geojson")
    )
    seed = load_seed(_load("huachi_test_seed.json"), net)
    network_id = save_network(session, net, name="huachi-test", dataset_version="1")
    scenario_id = save_scenario(session, network_id, seed, name="Base", version="1")
    return net, seed, network_id, scenario_id


def test_network_roundtrip():
    engine = make_engine("sqlite:///:memory:")
    with Session(engine) as session:
        net, seed, network_id, scenario_id = _setup(session)
        recovered = get_network(session, network_id)
        assert [n.id for n in recovered.nodes] == [n.id for n in net.nodes]
        assert [r.id for r in recovered.roads] == [r.id for r in net.roads]
        # La red debe reconstruirse equivalente (incluidos metadatos).
        assert recovered == net


def test_scenario_roundtrip():
    engine = make_engine("sqlite:///:memory:")
    with Session(engine) as session:
        net, seed, network_id, scenario_id = _setup(session)
        recovered = get_seed(session, scenario_id)
        assert recovered == seed


def test_execution_roundtrip():
    engine = make_engine("sqlite:///:memory:")
    with Session(engine) as session:
        net, seed, network_id, scenario_id = _setup(session)
        request = build_scenario(net, seed, "base")
        result = optimize(request)
        exec_id = save_execution(session, scenario_id, result)
        recovered = get_execution(session, exec_id)
        assert recovered == result
        assert recovered.status == "optimal"
        assert recovered.total_cost == 500


def test_change_recorded():
    engine = make_engine("sqlite:///:memory:")
    with Session(engine) as session:
        net, seed, network_id, scenario_id = _setup(session)
        record_change(session, scenario_id, "cierre de test-R3")
        db = session.get(Scenario, scenario_id)
        assert [c.description for c in db.changes] == ["cierre de test-R3"]


def test_file_backed_persistence(tmp_path):
    """La persistencia sobrevive a cerrar y reabrir la base (archivo SQLite)."""
    db_path = tmp_path / "smartflow.db"
    engine = make_engine(f"sqlite:///{db_path}")
    with Session(engine) as session:
        net, seed, network_id, scenario_id = _setup(session)
        request = build_scenario(net, seed, "base")
        exec_id = save_execution(session, scenario_id, optimize(request))

    # Nueva conexión: la información debe recuperarse desde el archivo.
    engine2 = make_engine(f"sqlite:///{db_path}")
    with Session(engine2) as session:
        assert get_network(session, network_id) == net
        assert get_seed(session, scenario_id) == seed
        assert get_execution(session, exec_id).total_cost == 500
