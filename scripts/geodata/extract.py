"""Fetch or reuse the public OSM vector extract for the proposed Huachi area."""

import argparse
from pathlib import Path
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from xml.etree import ElementTree

BBOX = (-78.628, -1.273, -78.620, -1.265)
CAMPUS_WAY = "341833423"
URL = "https://api.openstreetmap.org/api/0.6/map?bbox=" + ",".join(map(str, BBOX))


def validate_extract(payload):
    root = ElementTree.fromstring(payload)
    if root.tag != "osm" or root.find(f"way[@id='{CAMPUS_WAY}']") is None:
        raise ValueError("El extracto debe contener el campus Huachi de OSM.")
    return root


def fetch(cache):
    if cache.exists():
        validate_extract(cache.read_bytes())
        return
    request = Request(URL, headers={"User-Agent": "SmartFlow-Huachi academic GIS (github.com/Garcia2501/ProyectoIO)"})
    for attempt in range(3):
        try:
            with urlopen(request, timeout=30) as response:
                payload = response.read()
            validate_extract(payload)
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_bytes(payload)
            return
        except (HTTPError, URLError, TimeoutError) as error:
            if isinstance(error, HTTPError) and error.code not in (429, 500, 502, 503, 504):
                raise
            if attempt == 2:
                raise
            retry_after = error.headers.get("Retry-After", "") if isinstance(error, HTTPError) else ""
            if retry_after.isdecimal() and int(retry_after) > 60:
                raise
            time.sleep(max(2 ** (attempt + 1), int(retry_after) if retry_after.isdecimal() else 0))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cache", type=Path, help="Ruta local para el extracto XML")
    fetch(parser.parse_args().cache)
