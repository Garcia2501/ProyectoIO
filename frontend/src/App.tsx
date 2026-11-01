import { useState } from 'react'
import { NetworkCanvas } from './features/network/NetworkCanvas'
import { referenceScenario } from './features/network/referenceScenario'

export default function App() {
  const [selectedRoadId, setSelectedRoadId] = useState<string | null>(null)
  const selectedRoad = referenceScenario.roads.find(road => road.id === selectedRoadId)
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <a className="brand" href="#workspace"><span className="brand-mark" aria-hidden="true">↗</span><span>SmartFlow<small>LABORATORIO VIAL</small></span></a>
        <p className="nav-label">ESPACIO DE TRABAJO</p>
        <a className="nav-active" href="#workspace" aria-current="page"><span aria-hidden="true">◈</span> Red vial</a>
        <div className="sidebar-note"><span className="status-dot" />Proyecto académico<p>Explora cómo se distribuye el flujo en una red dirigida.</p></div>
        <footer>Investigación Operativa<br /><span>Flujo de costo mínimo</span></footer>
      </aside>
      <main id="workspace" className="workspace">
        <header className="topbar"><span>Laboratorio <span className="breadcrumb">/</span> Red vial</span><span className="stage-badge">Etapa 1 · Exploración</span></header>
        <section className="page-heading">
          <div><p className="eyebrow">DISEÑA. EXPLORA. COMPRENDE.</p><h1>Tu red, en perspectiva.</h1><p>Un espacio para explorar conexiones, capacidades y decisiones.</p></div>
          <span className="scenario-badge"><span className="status-dot" />Escenario Base</span>
        </section>
        <section className="summary-grid" aria-label="Resumen del escenario">
          <article className="summary-card"><span>Nodos de la red</span><strong>03 <small>zonas conectadas</small></strong></article>
          <article className="summary-card"><span>Vías dirigidas</span><strong>03 <small>tramos disponibles</small></strong></article>
          <article className="summary-card"><span>Oferta total</span><strong>100 <small>vehículos / intervalo</small></strong></article>
        </section>
        <div className="editor-grid">
          <section className="panel graph-panel" aria-labelledby="network-title">
            <div className="panel-header"><div><h2 id="network-title">Red de referencia</h2><p>Arrastra las zonas y selecciona una vía para inspeccionarla.</p></div><span className="subtle-tag">Grafo dirigido</span></div>
            <NetworkCanvas selectedRoadId={selectedRoadId} onSelectRoad={setSelectedRoadId} />
            <div className="graph-legend"><span><i className="legend-dot supply" />Origen</span><span><i className="legend-dot transit" />Tránsito</span><span><i className="legend-dot demand" />Destino</span><span className="legend-hint">c: costo · cap: capacidad</span></div>
          </section>
          <aside className="panel inspector" aria-labelledby="inspector-title">
            <p className="eyebrow">INSPECTOR DE RED</p><h2 id="inspector-title">Cada conexión cuenta.</h2>
            <p className="inspector-intro">Selecciona un tramo en el lienzo o en la lista para consultar sus propiedades.</p>
            <div className="road-list" aria-label="Vías de la red">{referenceScenario.roads.map(road => (
              <button key={road.id} type="button" aria-pressed={selectedRoadId === road.id} onClick={() => setSelectedRoadId(road.id)} className="road-button">
                <span className="road-icon" aria-hidden="true">↗</span><span><strong>{road.id}</strong><small>{road.source} → {road.target}</small></span><span className="road-cap">{road.capacity}<small>capacidad</small></span>
              </button>
            ))}</div>
            <div className="road-details" aria-live="polite">{selectedRoad ? (
              <><p className="detail-title">Tramo {selectedRoad.id} <span>Habilitado</span></p>
                <dl><div><dt>Dirección</dt><dd>{selectedRoad.source} → {selectedRoad.target}</dd></div><div><dt>Costo por vehículo</dt><dd>{selectedRoad.unit_cost} u.</dd></div><div><dt>Capacidad por intervalo</dt><dd>{selectedRoad.capacity} veh.</dd></div></dl></>
            ) : <p className="empty-selection">Todavía no hay un tramo seleccionado.</p>}</div>
            <div className="inspector-foot"><strong>Próximo paso: editar tu escenario</strong><p>La edición y la optimización se incorporarán en las siguientes etapas.</p></div>
          </aside>
        </div>
        <div className="model-note"><span aria-hidden="true">ⓘ</span><p><strong>Un modelo para aprender.</strong> Las capacidades se expresan en vehículos por intervalo y los costos en unidades abstractas por vehículo. Esta vista no predice tráfico real. Aún no se ha ejecutado ninguna optimización.</p></div>
      </main>
    </div>
  )
}

