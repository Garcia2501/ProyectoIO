"""Render an offline SVG of the proposed cut, campus and OSM streets."""

import argparse
from html import escape
import json
from pathlib import Path


def preview(directory):
    provenance = json.loads((directory / "provenance.json").read_text(encoding="utf-8"))
    roads = json.loads((directory / "huachi_roads.geojson").read_text(encoding="utf-8"))["features"]
    west, south = provenance["boundary"][0][0]
    east, north = provenance["boundary"][0][2]

    def point(coord):
        x, y = coord
        return f"{55 + 690 * (x-west)/(east-west):.1f},{85 + 690 * (north-y)/(north-south):.1f}"

    parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="850" viewBox="0 0 800 850">',
        '<rect width="800" height="850" fill="#f5f7fa"/>',
        '<text x="55" y="41" font-family="sans-serif" font-size="25" fill="#182d41">Huachi · recorte propuesto</text>',
        '<text x="55" y="65" font-family="sans-serif" font-size="14" fill="#42586e">Norte arriba · Ambato, Ecuador</text>',
        '<rect x="55" y="85" width="690" height="690" fill="#fff" stroke="#52667a" stroke-dasharray="5 5"/>',
        '<polygon fill="#d5f2e8" stroke="#188262" stroke-width="2" points="'
        + " ".join(map(point, provenance["campus"]["coordinates"])) + '"/>',
    ]
    labels = {}
    for road in roads:
        properties = road["properties"]
        line = road["geometry"]["coordinates"]
        name = properties.get("name", "")
        normalized = name.lower().replace("í", "i")
        highlighted = any(key in normalized for key in ("chasquis", "payamino", "guayllabamba"))
        color = "#165caf" if highlighted else "#9aabbb"
        coords = " ".join(map(point, line))
        parts.append(f'<polyline fill="none" stroke="{color}" stroke-width="{3 if highlighted else 1.5}" points="{coords}"><title>{escape(name or properties["road_id"])}</title></polyline>')
        if highlighted and (name not in labels or properties["length_m"] > labels[name][0]):
            labels[name] = properties["length_m"], line[len(line) // 2]
    for name, (_, coord) in labels.items():
        x, y = point(coord).split(",")
        parts.append(f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="13" fill="#0a3361" stroke="#fff" stroke-width="4" paint-order="stroke">{escape(name)}</text>')
    parts.extend([
        '<text x="55" y="806" font-family="sans-serif" font-size="14" fill="#42586e">Verde: campus UTA Huachi · Azul: vías de referencia</text>',
        '<a href="https://www.openstreetmap.org/copyright"><text x="55" y="830" font-family="sans-serif" font-size="13" fill="#165caf">© OpenStreetMap contributors · ODbL</text></a>',
        '</svg>',
    ])
    return "\n".join(parts) + "\n"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.output.write_text(preview(args.directory), encoding="utf-8")
