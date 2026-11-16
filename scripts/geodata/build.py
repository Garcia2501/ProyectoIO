"""Convert the cached OSM extract into the SmartFlow Huachi draft dataset."""

import argparse
from collections import Counter, defaultdict
from datetime import date
import hashlib
import heapq
import json
import math
from pathlib import Path

from extract import BBOX, CAMPUS_WAY, URL, validate_extract

MOTOR = set("primary secondary tertiary unclassified residential living_street service primary_link secondary_link tertiary_link".split())
RESTRICTED = {"no", "private", "destination", "customers", "delivery", "agricultural", "forestry"}
ASSUMPTION = "OSM no confirma el sentido; ambos arcos son un supuesto experimental pendiente de revisión."
REVIEW_WAYS = (
    "188553491", "896918264", "248048826", "535046114", "188554514",
    "371960678", "392008846", "345129392", "188553492", "188553186",
    "188554480",
)


def tags(element):
    return {tag.attrib["k"]: tag.attrib["v"] for tag in element.findall("tag")}


def inside(point):
    west, south, east, north = BBOX
    return west <= point[0] <= east and south <= point[1] <= north


def distance(a, b):
    lon1, lat1, lon2, lat2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2)**2
    return 12742017.6 * math.asin(min(1, math.sqrt(h)))


def directions(attributes):
    explicit = attributes.get("oneway")
    if explicit in {"yes", "true", "1"}:
        return True, (1,)
    if explicit == "-1":
        return True, (-1,)
    if explicit in {"no", "false", "0"}:
        return False, (1, -1)
    if explicit is None and attributes.get("junction") in {"roundabout", "circular"}:
        return True, (1,)
    if explicit is None:
        return "unknown", (1, -1)
    return "unknown", ()


def feature(geometry, coordinates, **properties):
    return {"type": "Feature", "geometry": {"type": geometry, "coordinates": coordinates},
            "properties": properties}


def collection(features):
    return {"type": "FeatureCollection", "features": features}


def graph(root):
    positions = {n.attrib["id"]: [float(n.attrib["lon"]), float(n.attrib["lat"])] for n in root.findall("node")}
    runs = []
    for way in sorted(root.findall("way"), key=lambda w: int(w.attrib["id"])):
        attributes = tags(way)
        access = next((attributes[k] for k in ("motorcar", "motor_vehicle", "vehicle", "access") if k in attributes), None)
        if attributes.get("highway") not in MOTOR or access in RESTRICTED:
            continue
        if any(k.endswith(":conditional") for k in attributes):
            continue
        oneway, allowed = directions(attributes)
        if not allowed:
            continue
        run = []
        for ref in [n.attrib["ref"] for n in way.findall("nd")] + [None]:
            if ref in positions and inside(positions[ref]):
                run.append(ref)
            else:
                if len(run) >= 2:
                    runs.append((way.attrib["id"], attributes, oneway, allowed, run))
                run = []
    counts = Counter(n for _, _, _, _, run in runs for n in run)
    used = set()
    roads = []
    ids = set()
    for way, attributes, oneway, allowed, run in runs:
        cuts = [0, *(i for i in range(1, len(run) - 1) if counts[run[i]] > 1), len(run) - 1]
        for start, end in zip(cuts, cuts[1:]):
            segment = run[start:end + 1]
            line = [positions[n] for n in segment]
            length = sum(distance(a, b) for a, b in zip(line, line[1:]))
            if length == 0:
                continue
            digest = hashlib.sha256(",".join(segment).encode()).hexdigest()[:12]
            for direction in allowed:
                source, target = segment[::direction][0], segment[::direction][-1]
                road_id = f"osm-w{way}-{digest}-{'f' if direction == 1 else 'r'}"
                if road_id in ids:
                    raise ValueError(f"Arco duplicado: {road_id}")
                ids.add(road_id)
                used.update((source, target))
                properties = dict(road_id=road_id, source="osm-n" + source, target="osm-n" + target,
                                  osm_way_ids=[way], oneway=oneway, source_quality="OpenStreetMap",
                                  verified=False, length_m=round(length, 3), highway=attributes["highway"],
                                  osm_node_ids=segment[::direction])
                if attributes.get("name"):
                    properties["name"] = attributes["name"]
                if oneway == "unknown":
                    properties["assumptions"] = ASSUMPTION
                roads.append(feature("LineString", line[::direction], **properties))
    neighbors = defaultdict(set)
    for road in roads:
        p = road["properties"]
        neighbors[p["source"]].add(p["target"])
        neighbors[p["target"]].add(p["source"])
    nodes = [feature("Point", positions[n], node_id="osm-n" + n, label="OSM " + n,
                     node_kind="intersection" if len(neighbors["osm-n" + n]) >= 3 else "segment_endpoint")
             for n in sorted(used, key=int)]
    return nodes, roads


def route(outgoing, source, target, excluded=frozenset()):
    queue = [(0, source, [])]
    best = {source: 0}
    while queue:
        cost, node, path = heapq.heappop(queue)
        if cost != best[node]:
            continue
        if node == target:
            return path
        for road in outgoing[node]:
            if road["road_id"] in excluded:
                continue
            next_cost = cost + max(1, round(road["length_m"]))
            if next_cost < best.get(road["target"], math.inf):
                best[road["target"]] = next_cost
                heapq.heappush(queue, (next_cost, road["target"], path + [road["road_id"]]))
    return []


def seed_for(nodes, roads, center):
    outgoing = defaultdict(list)
    for road in roads:
        p = road["properties"]
        outgoing[p["source"]].append(p)
    nearby = sorted(
        (n for n in nodes if any(p.get("name") and p["highway"] != "service"
                                 for p in outgoing[n["properties"]["node_id"]])),
        key=lambda n: distance(n["geometry"]["coordinates"], center),
    )[:24]
    pairs = sorted(((a, b) for a in nearby for b in nearby if a is not b),
                   key=lambda pair: -distance(*(n["geometry"]["coordinates"] for n in pair)))
    for a, b in pairs:
        source, target = (n["properties"]["node_id"] for n in (a, b))
        primary = route(outgoing, source, target)
        alternate = route(outgoing, source, target, set(primary))
        if primary and alternate:
            parameters = {p["road_id"]: {"capacity": 60, "unit_cost": max(1, round(p["length_m"])),
                                         "enabled": True}
                          for r in roads for p in [r["properties"]]}
            return {"balances": {source: 60, target: -60}, "roads": parameters,
                    "closure_road_ids": [primary[0]], "limit_capacity_factor": 0.01,
                    "assumptions": "Oferta y capacidad uniformes de 60 vehículos por intervalo experimental; costo entero proporcional a longitud en metros, sin calibración. El factor límite reduce la capacidad entera a cero.",
                    "reference_paths": {"base_feasible_path": primary, "closure_feasible_path": alternate}}
    raise ValueError("El recorte no ofrece dos rutas dirigidas disjuntas entre los nodos cercanos al campus.")


def write_json(directory, name, value):
    (directory / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build(cache, output, extracted_at):
    payload = cache.read_bytes()
    root = validate_extract(payload)
    campus = root.find(f"way[@id='{CAMPUS_WAY}']")
    positions = {n.attrib["id"]: [float(n.attrib["lon"]), float(n.attrib["lat"])] for n in root.findall("node")}
    footprint = [positions[n.attrib["ref"]] for n in campus.findall("nd")]
    center = [sum(p[i] for p in footprint) / len(footprint) for i in range(2)]
    nodes, roads = graph(root)
    seed = seed_for(nodes, roads, center)
    restrictions = [
        {"osm_relation_id": rel.attrib["id"], "tags": tags(rel),
         "members": [member.attrib for member in rel.findall("member")]}
        for rel in root.findall("relation") if tags(rel).get("type") == "restriction"
    ]
    reviewed = []
    for way_id in REVIEW_WAYS:
        way = root.find(f"way[@id='{way_id}']")
        if way is None:
            continue
        attributes = tags(way)
        refs = [node.attrib["ref"] for node in way.findall("nd")]
        reviewed.append({
            "osm_way_id": way_id,
            "name": attributes.get("name"),
            "highway": attributes.get("highway"),
            "osm_oneway": attributes.get("oneway"),
            "shares_campus_perimeter_node": bool(
                set(refs) & {node.attrib["ref"] for node in campus.findall("nd")}
            ),
            "status": "OSM consultado; comprobación independiente pendiente",
        })
    west, south, east, north = BBOX
    polygon = [[[west, south], [east, south], [east, north], [west, north], [west, south]]]
    output.mkdir(parents=True, exist_ok=True)
    write_json(output, "huachi_boundary.geojson", feature("Polygon", polygon, status="proposed"))
    write_json(output, "huachi_nodes.geojson", collection(nodes))
    write_json(output, "huachi_roads.geojson", collection(roads))
    write_json(output, "huachi_scenario_seed.json", seed)
    write_json(output, "provenance.json", {
        "source": "OpenStreetMap", "source_url": URL, "extracted_at": extracted_at,
        "license": "ODbL-1.0", "license_url": "https://www.openstreetmap.org/copyright",
        "attribution": "© OpenStreetMap contributors", "extract_sha256": hashlib.sha256(payload).hexdigest(),
        "extractor_version": 1, "boundary": polygon, "boundary_status": "proposed",
        "campus": {"osm_way_id": CAMPUS_WAY, "coordinates": footprint},
        "turn_restrictions_not_modeled": restrictions,
        "review_candidates": reviewed,
        "notes": [
            "Recorte propuesto pendiente de aprobación del equipo.",
            "Se conservan tramos entre nodos OSM consecutivos dentro del rectángulo; no se crean cruces por intersección visual.",
            "Los sentidos sin etiqueta se modelan en ambos sentidos como supuesto explícito. Los tramos con accesos restringidos o condiciones etiquetadas se excluyen.",
            "verified=false indica revisión humana pendiente. Restricciones de giro y accesos señalizados requieren revisión antes de interpretar el resultado.",
        ],
    })


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cache", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--extracted-at", required=True, type=date.fromisoformat)
    args = parser.parse_args()
    build(args.cache, args.output, args.extracted_at.isoformat())
