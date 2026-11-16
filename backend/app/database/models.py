"""Modelos ORM (SQLAlchemy 2) para la persistencia SQLite de SmartFlow.

Persisten, según el apartado D del plan V2.0:

- ``networks``: red/área versionada (dataset).
- ``nodes`` / ``roads``: nodos y arcos dirigidos de una red.
- ``scenarios``: escenario experimental con sus parámetros asumidos.
- ``changes``: cambios registrados sobre un escenario.
- ``executions``: ejecuciones del optimizador.
- ``flow_results``: resultados de flujo por vía de una ejecución.

No hay tablas de usuarios ni de roles.
"""

from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Network(Base):
    """Red/área versionada: un conjunto de nodos y vías de un dataset."""

    __tablename__ = "networks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True, index=True)
    dataset_version: Mapped[str] = mapped_column(String, default="1")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    nodes: Mapped[List["Node"]] = relationship(
        back_populates="network", cascade="all, delete-orphan"
    )
    roads: Mapped[List["Road"]] = relationship(
        back_populates="network", cascade="all, delete-orphan"
    )
    scenarios: Mapped[List["Scenario"]] = relationship(
        back_populates="network", cascade="all, delete-orphan"
    )


class Node(Base):
    __tablename__ = "nodes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    network_id: Mapped[int] = mapped_column(ForeignKey("networks.id"), index=True)
    node_id: Mapped[str] = mapped_column(String)
    label: Mapped[str] = mapped_column(String)
    lon: Mapped[float] = mapped_column(Float)
    lat: Mapped[float] = mapped_column(Float)
    node_kind: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    network: Mapped[Network] = relationship(back_populates="nodes")


class Road(Base):
    __tablename__ = "roads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    network_id: Mapped[int] = mapped_column(ForeignKey("networks.id"), index=True)
    road_id: Mapped[str] = mapped_column(String)
    source: Mapped[str] = mapped_column(String)
    target: Mapped[str] = mapped_column(String)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # "true" | "false" | "unknown"
    oneway: Mapped[str] = mapped_column(String)
    source_quality: Mapped[str] = mapped_column(String)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    length_m: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    osm_way_ids: Mapped[list] = mapped_column(JSON, default=list)
    assumptions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    network: Mapped[Network] = relationship(back_populates="roads")


class Scenario(Base):
    """Escenario experimental: identifica versión del dataset y parámetros asumidos."""

    __tablename__ = "scenarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    network_id: Mapped[int] = mapped_column(ForeignKey("networks.id"), index=True)
    name: Mapped[str] = mapped_column(String)
    version: Mapped[str] = mapped_column(String, default="1")
    # {node_id: balance}
    balances: Mapped[dict] = mapped_column(JSON)
    # {road_id: {"capacity": int, "unit_cost": int, "enabled": bool}}
    roads: Mapped[dict] = mapped_column(JSON)
    closure_road_ids: Mapped[list] = mapped_column(JSON, default=list)
    limit_capacity_factor: Mapped[float] = mapped_column(Float)
    assumptions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    network: Mapped[Network] = relationship(back_populates="scenarios")
    changes: Mapped[List["Change"]] = relationship(
        back_populates="scenario", cascade="all, delete-orphan"
    )
    executions: Mapped[List["Execution"]] = relationship(
        back_populates="scenario", cascade="all, delete-orphan"
    )


class Change(Base):
    """Cambio registrado sobre un escenario (p. ej. cierre de una vía)."""

    __tablename__ = "changes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    scenario_id: Mapped[int] = mapped_column(ForeignKey("scenarios.id"), index=True)
    description: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    scenario: Mapped[Scenario] = relationship(back_populates="changes")


class Execution(Base):
    """Ejecución del optimizador sobre un escenario."""

    __tablename__ = "executions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    scenario_id: Mapped[int] = mapped_column(ForeignKey("scenarios.id"), index=True)
    status: Mapped[str] = mapped_column(String)  # "optimal" | "infeasible"
    total_cost: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    total_supply: Mapped[int] = mapped_column(Integer)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    scenario: Mapped[Scenario] = relationship(back_populates="executions")
    results: Mapped[List["FlowResult"]] = relationship(
        back_populates="execution", cascade="all, delete-orphan"
    )


class FlowResult(Base):
    """Resultado de flujo por vía de una ejecución."""

    __tablename__ = "flow_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    execution_id: Mapped[int] = mapped_column(ForeignKey("executions.id"), index=True)
    road_id: Mapped[str] = mapped_column(String)
    flow: Mapped[int] = mapped_column(Integer)
    capacity: Mapped[int] = mapped_column(Integer)
    utilization_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    execution: Mapped[Execution] = relationship(back_populates="results")
