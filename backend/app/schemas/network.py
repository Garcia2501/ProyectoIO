"""Modelos del contrato REST de SmartFlow.

Los IDs son cadenas estables. Flujo, capacidad, costo y balance son ENTEROS
(vehículos por intervalo simulado y costo por vehículo/tramo). ``x``/``y`` solo
ubican los nodos visualmente.

Límites numéricos
-----------------
Todas las magnitudes enteras del contrato se restringen al rango de enteros
seguros de JavaScript (``2**53 - 1``). Esto:

- garantiza que el frontend (números IEEE 754) representa exactamente
  ``flow``, ``capacity``, ``balance``, ``total_cost`` y ``total_supply``;
- evita el desbordamiento de los enteros de 64 bits que usa OR-Tools en la
  acumulación de costos (``flow * unit_cost``).

Por eso ``balance``, ``capacity`` y ``unit_cost`` usan ``StrictInt``: se
rechazan booleanos, cadenas numéricas y flotantes (un JSON booleano o numérico
en forma de texto no debe convertirse silenciosamente en una cantidad del
modelo). Además se validan las magnitudes derivadas (oferta total y cota de
costo) antes de invocar al solver.
"""

from typing import List

from pydantic import BaseModel, Field, StrictInt, field_validator, model_validator

# Entero seguro máximo de JavaScript (2^53 - 1).
MAX_SAFE_INT = 2**53 - 1


class Node(BaseModel):
    """Nodo de la red vial (zona)."""

    id: str
    label: str
    x: float
    y: float
    # balance > 0 oferta, < 0 demanda, == 0 tránsito.
    balance: StrictInt = Field(ge=-MAX_SAFE_INT, le=MAX_SAFE_INT)

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
    capacity: StrictInt = Field(ge=0, le=MAX_SAFE_INT)
    unit_cost: StrictInt = Field(ge=0, le=MAX_SAFE_INT)
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

    @model_validator(mode="after")
    def _validate_magnitudes(self) -> "OptimizeRequest":
        """Rechaza magnitudes derivadas fuera del dominio soportado.

        Se comprueban la oferta total y una cota superior del costo total
        (``sum(flujo <= capacidad) * unit_cost``), garantizando que ni OR-Tools
        desborde sus enteros de 64 bits ni el frontend pierda precisión.
        """
        total_supply = sum(max(0, node.balance) for node in self.nodes)
        if total_supply > MAX_SAFE_INT:
            raise ValueError(
                f"la oferta total {total_supply} excede el límite soportado "
                f"({MAX_SAFE_INT})"
            )

        cost_bound = sum(
            (road.capacity if road.enabled else 0) * road.unit_cost
            for road in self.roads
        )
        if cost_bound > MAX_SAFE_INT:
            raise ValueError(
                f"la magnitud de costos {cost_bound} excede el límite "
                f"soportado ({MAX_SAFE_INT})"
            )

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
