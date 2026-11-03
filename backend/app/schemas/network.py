"""Modelos del contrato REST de SmartFlow.

Los IDs son cadenas estables. Flujo, capacidad, costo y balance son ENTEROS
(vehículos por intervalo simulado y costo por vehículo/tramo). ``x``/``y`` solo
ubican los nodos visualmente.
"""

from typing import List

from pydantic import BaseModel, Field, field_validator, model_validator


class Node(BaseModel):
    """Nodo de la red vial (zona)."""

    id: str
    label: str
    x: float
    y: float
    # balance > 0 oferta, < 0 demanda, == 0 tránsito.
    balance: int

    @field_validator("id", "label")
    @classmethod
    def _non_blank(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("no puede estar vacío")
        return value


class Road(BaseModel):
    """Arco dirigido entre dos nodos. Una vía bidireccional son dos arcos."""

    id: str
    source: str
    target: str
    capacity: int = Field(ge=0)
    unit_cost: int = Field(ge=0)
    enabled: bool = True

    @field_validator("id")
    @classmethod
    def _non_blank_id(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("no puede estar vacío")
        return value


class OptimizeRequest(BaseModel):
    """Solicitud de optimización de un escenario."""

    scenario_name: str
    nodes: List[Node]
    roads: List[Road]

    @field_validator("scenario_name")
    @classmethod
    def _non_blank_name(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("no puede estar vacío")
        return value

    @model_validator(mode="after")
    def _validate_graph(self) -> "OptimizeRequest":
        if len(self.nodes) < 2:
            raise ValueError("se requieren al menos 2 nodos")

        node_ids = [node.id for node in self.nodes]
        if len(set(node_ids)) != len(node_ids):
            raise ValueError("los identificadores de nodos deben ser únicos")

        road_ids = [road.id for road in self.roads]
        if len(set(road_ids)) != len(road_ids):
            raise ValueError("los identificadores de vías deben ser únicos")

        valid_ids = set(node_ids)
        for road in self.roads:
            if road.source not in valid_ids:
                raise ValueError(
                    f"vía {road.id}: nodo origen inexistente '{road.source}'"
                )
            if road.target not in valid_ids:
                raise ValueError(
                    f"vía {road.id}: nodo destino inexistente '{road.target}'"
                )

        if sum(node.balance for node in self.nodes) != 0:
            raise ValueError("la suma de balances debe ser cero")

        return self


class RoadResult(BaseModel):
    """Resultado por vía, en el mismo orden que la solicitud."""

    id: str
    flow: int
    # Capacidad efectiva (0 cuando la vía está deshabilitada).
    capacity: int
    utilization_pct: float | None


class OptimizeResponse(BaseModel):
    """Respuesta del contrato REST."""

    status: str
    scenario_name: str
    total_cost: int | None
    total_supply: int
    roads: List[RoadResult]
    message: str | None = None
