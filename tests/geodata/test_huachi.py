import json
from pathlib import Path
import sys

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/geodata"))
from build import directions, distance, inside


def read(name):
    return json.loads((ROOT / "data/geography" / name).read_text(encoding="utf-8"))


def test_dataset_topology_and_direction():
    nodes = read("huachi_nodes.geojson")["features"]
    roads = read("huachi_roads.geojson")["features"]
    positions = {n["properties"]["node_id"]: n["geometry"]["coordinates"] for n in nodes}
    assert len(positions) == len(nodes)
    assert len({r["properties"]["road_id"] for r in roads}) == len(roads)
    used = set()
    for road in roads:
        p = road["properties"]
        coords = road["geometry"]["coordinates"]
        assert road["geometry"]["type"] == "LineString"
        assert coords[0] == positions[p["source"]]
        assert coords[-1] == positions[p["target"]]
        assert p["osm_node_ids"][0] == p["source"].removeprefix("osm-n")
        assert p["osm_node_ids"][-1] == p["target"].removeprefix("osm-n")
        assert all(inside(c) for c in coords)
        assert sum(distance(a, b) for a, b in zip(coords, coords[1:])) > 0
        assert p["oneway"] != "unknown" or p["assumptions"]
        used.update((p["source"], p["target"]))
    assert used == positions.keys()


@pytest.mark.parametrize(("attributes", "expected"), [
    ({"oneway": "yes"}, (True, (1,))),
    ({"oneway": "-1"}, (True, (-1,))),
    ({"oneway": "no"}, (False, (1, -1))),
    ({"junction": "roundabout"}, (True, (1,))),
    ({}, ("unknown", (1, -1))),
    ({"oneway": "reversible"}, ("unknown", ())),
])
def test_direction_rules(attributes, expected):
    assert directions(attributes) == expected


@pytest.mark.parametrize(("variant", "expected"), [
    ("base", "optimal"),
    ("closure", "optimal"),
    ("limit", "infeasible"),
])
def test_real_optimizer(variant, expected):
    sys.path.insert(0, str(ROOT / "backend"))
    from app.schemas.network import OptimizeRequest
    from app.services.optimizer_service import optimize

    seed = read("huachi_scenario_seed.json")
    nodes = []
    for i, feature in enumerate(read("huachi_nodes.geojson")["features"]):
        p = feature["properties"]
        nodes.append(dict(id=p["node_id"], label=p["label"], x=i, y=0,
                          balance=seed["balances"].get(p["node_id"], 0)))
    roads = []
    for feature in read("huachi_roads.geojson")["features"]:
        p = feature["properties"]
        road = dict(id=p["road_id"], source=p["source"], target=p["target"],
                    **seed["roads"][p["road_id"]])
        if variant == "closure" and road["id"] in seed["closure_road_ids"]:
            road["enabled"] = False
        if variant == "limit":
            road["capacity"] = int(road["capacity"] * seed["limit_capacity_factor"])
        roads.append(road)
    request = OptimizeRequest(scenario_name=variant, nodes=nodes, roads=roads)
    result = optimize(request).model_dump()
    assert result["status"] == expected
    if expected == "optimal":
        flows = {r["id"]: r["flow"] for r in result["roads"]}
        net = {n["id"]: 0 for n in nodes}
        for r in roads:
            flow = flows[r["id"]]
            assert 0 <= flow <= (r["capacity"] if r["enabled"] else 0)
            net[r["source"]] += flow
            net[r["target"]] -= flow
        assert net == {n["id"]: n["balance"] for n in nodes}
        assert result["total_cost"] == sum(flows[r["id"]] * r["unit_cost"] for r in roads)
    print(variant, result["status"], result["total_cost"])
