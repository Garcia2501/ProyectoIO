import { act, renderHook } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { Vector3 } from 'three'
import {
  buildCity,
  makeBuildings,
  ribbon,
  vehicleAllocation,
} from '../features/simulation3d/cityModel'
import {
  VisualClock,
  utilizationColor,
  QUALITY,
} from '../features/simulation3d/visualClock'
import { metropolitanDemo } from '../features/simulation3d/metropolitanDemo'
import { CameraBus } from '../features/simulation3d/CameraBus'
import { referenceScenario } from '../features/network/referenceScenario'
import { validateNetwork } from '../features/network/validation'
import { optimize } from '../services/api'
import { useWorkspace } from '../features/scenarios/useWorkspace'

test('el reloj pausa, cambia velocidad y busca sin saltos ni acumulación de intervalos', () => {
  let now = 0
  const spy = vi.spyOn(performance, 'now').mockImplementation(() => now)
  try {
    const clock = new VisualClock()
    now = 1000
    expect(clock.time()).toBe(1)
    clock.speed(4)
    now = 2000
    expect(clock.time()).toBe(5)
    clock.pause()
    now = 9000
    expect(clock.time()).toBe(5)
    clock.play()
    now = 10000
    expect(clock.time()).toBe(9)
    clock.seek(119)
    now = 11000
    expect(clock.time()).toBe(120)
    expect(clock.snapshot().playing).toBe(false)
    clock.play()
    expect(clock.time()).toBe(0)
    clock.seek(-5)
    expect(clock.time()).toBe(0)
    clock.seek(400)
    expect(clock.time()).toBe(120)
    clock.restart()
    expect(clock.time()).toBe(0)
  } finally {
    spy.mockRestore()
  }
})
test('los umbrales distinguen utilización, falta de resultados y cierres', () => {
  expect(
    [59, 60, 79, 80, 94, 95, 100].map((v) => utilizationColor(v, true)),
  ).toEqual([
    '#32d19a',
    '#e8d75c',
    '#e8d75c',
    '#f1a457',
    '#f1a457',
    '#f06c7e',
    '#f06c7e',
  ])
  expect(utilizationColor(0, false)).toBe('#87939d')
  expect(utilizationColor(null, true)).toBe('#72bdd3')
  expect(utilizationColor(50, true, [30, 60, 90])).toBe('#e8d75c')
})
test('la proyección 3D es determinista, no muta la red y no genera flujo inexistente', () => {
  const original = structuredClone(referenceScenario),
    model = buildCity(original, null)
  expect(model.roads.map((r) => r.id)).toEqual(original.roads.map((r) => r.id))
  expect(
    model.roads.every(
      (r) =>
        r.length > 0 &&
        r.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.z)),
    ),
  ).toBe(true)
  expect(vehicleAllocation(model, 200)).toHaveLength(0)
  expect(original).toEqual(referenceScenario)
  const geometry = ribbon(model.roads[0].curve, 1, 0.03),
    normal = geometry.getAttribute('normal')
  expect(new Vector3().fromBufferAttribute(normal, 10).y).toBeGreaterThan(0.9)
  geometry.dispose()
})
test('los edificios respetan la reserva vial y las calidades limitan las instancias', () => {
  const { scenarios, results } = metropolitanDemo(),
    model = buildCity(scenarios[0], results[0])
  for (const quality of Object.values(QUALITY)) {
    const blocks = makeBuildings(model, quality.buildings)
    expect(blocks.length).toBeLessThanOrEqual(quality.buildings)
    expect(
      blocks.every((b) =>
        model.roads.every((r) =>
          r.points.every(
            (p) =>
              Math.hypot(
                Math.max(0, Math.abs(p.x - b.x) - b.w / 2),
                Math.max(0, Math.abs(p.z - b.z) - b.d / 2),
              ) > 0.6,
          ),
        ),
      ),
    ).toBe(true)
    const cars = vehicleAllocation(model, quality.vehicles)
    expect(cars.length).toBeLessThanOrEqual(quality.vehicles)
    expect(
      cars.every(
        (v) => v.road.enabled && v.road.flow > 0 && v.road.length > 0.75,
      ),
    ).toBe(true)
  }
})
test('ambas soluciones metropolitanas conservan balances, capacidades y costo exacto', async () => {
  const { scenarios, results } = metropolitanDemo()
  for (let i = 0; i < 2; i++) {
    const s = scenarios[i],
      r = results[i].data
    expect(validateNetwork(s)).toEqual([])
    expect(s.nodes).toHaveLength(36)
    expect(s.roads).toHaveLength(60)
    expect(results[i].demo).toBe(true)
    for (const node of s.nodes) {
      const net = s.roads.reduce(
        (n, road, j) =>
          n +
          (road.source === node.id ? r.roads[j].flow : 0) -
          (road.target === node.id ? r.roads[j].flow : 0),
        0,
      )
      expect(net).toBe(node.balance)
    }
    expect(
      r.roads.every((road) => road.flow >= 0 && road.flow <= road.capacity),
    ).toBe(true)
    expect(
      s.roads.reduce(
        (sum, road, j) => sum + road.unit_cost * r.roads[j].flow,
        0,
      ),
    ).toBe(1200)
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => r })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock)
    try {
      expect(await optimize(s)).toEqual(r)
    } finally {
      fetchSpy.mockRestore()
    }
  }
})
test('una carretera cerrada elimina vehículos aunque exista un resultado anterior', () => {
  const { scenarios, results } = metropolitanDemo(),
    s = structuredClone(scenarios[0])
  s.roads.forEach((r) => {
    r.enabled = false
  })
  expect(vehicleAllocation(buildCity(s, results[0]), 240)).toHaveLength(0)
})
test('la cámara compartida no realimenta al emisor y descarta poses repetidas', () => {
  const bus = new CameraBus(),
    a = vi.fn(),
    b = vi.fn()
  bus.subscribe('a', a)
  const stop = bus.subscribe('b', b)
  const pose = {
    position: [1, 2, 3] as [number, number, number],
    target: [0, 0, 0] as [number, number, number],
  }
  bus.publish('a', pose)
  expect(a).not.toHaveBeenCalled()
  expect(b).toHaveBeenCalledOnce()
  bus.publish('b', pose)
  expect(a).not.toHaveBeenCalled()
  stop()
  bus.publish('a', { ...pose, position: [2, 3, 4] })
  expect(b).toHaveBeenCalledOnce()
})
test('cerrar y optimizar envía la red modificada, no la captura anterior del estado', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      status: 'infeasible',
      scenario_name: 'Base',
      total_cost: null,
      total_supply: 100,
      roads: [],
    }),
  })
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock)
  try {
    const { result } = renderHook(() => useWorkspace())
    act(() => result.current.demo())
    const next = {
      ...result.current.scenario,
      roads: result.current.scenario.roads.map((r) => ({
        ...r,
        enabled: r.id !== 'R1',
      })),
    }
    await act(async () => {
      result.current.update(next)
      await result.current.run(next)
    })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).roads[0].enabled).toBe(
      false,
    )
    expect(result.current.results[0]?.demo).toBe(false)
    expect(result.current.results[0]?.data.status).toBe('infeasible')
  } finally {
    fetchSpy.mockRestore()
  }
})
