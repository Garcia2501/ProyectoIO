"""Modelos de datos geográficos (GeoJSON) y semilla de escenario.

Representan el contrato de datos que entrega el equipo GIS (``data/geography/``)
y que este backend importa para construir el grafo dirigido de optimización.
"""

from typing import Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field, StrictInt

OneWay = Union[bool, Literal["unknown"]]


class GeoNode(BaseModel):
    """Nodo geográfico (cruce o extremo de segmento)."""

    id: str
    label: str
    lon: float
    lat: float
    kind: Optional[str] = None  # node_kind: intersection | segment_endpoint


class GeoRoad(BaseModel):
    """Arco dirigido geográfico. La geometría es externa a la optimización."""

    id: str
    source: str
    target: str
    name: Optional[str] = None
    oneway: OneWay
    source_quality: str
    verified: bool = False
    osm_way_ids: List[str] = Field(default_factory=list)
    length_m: Optional[float] = None
    assumptions: Optional[str] = None


class GeoNetwork(BaseModel):
    """Red geográfica validada: nodos + arcos dirigidos."""

    nodes: List[GeoNode]
    roads: List[GeoRoad]


class SeedRoad(BaseModel):
    """Parámetros experimentales de una vía en la semilla."""

    capacity: StrictInt = Field(ge=0)
    unit_cost: StrictInt = Field(ge=0)
    enabled: bool = True


class ScenarioSeed(BaseModel):
    """Semilla experimental: oferta/demanda, capacidades, costos y cierres.

    Todos los valores son SUPUESTOS del estudio, no mediciones; la geografía
    proviene de los GeoJSON. ``limit_capacity_factor`` reduce la capacidad
    entera (con factor suficientemente pequeño la lleva a cero -> infeasible).
    """

    balances: Dict[str, int]
    roads: Dict[str, SeedRoad]
    closure_road_ids: List[str] = Field(default_factory=list)
    limit_capacity_factor: float = Field(default=0.5, gt=0, lt=1)
