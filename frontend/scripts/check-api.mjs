import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const baseURL = (
  process.env.SMARTFLOW_API_URL || 'http://127.0.0.1:8000/api/v1'
).replace(/\/$/, '')
const loadTS = async (source) => {
  const code = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
  }).outputText
  return import(
    'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
  )
}
// Exercise the production client validation, not a second implementation.
const { optimize } = await loadTS(
  fs
    .readFileSync(new URL('../src/services/api.ts', import.meta.url), 'utf8')
    .replaceAll('import.meta.env.VITE_API_URL', JSON.stringify(baseURL)),
)
const { metropolitanDemo } = await loadTS(
  fs.readFileSync(
    new URL(
      '../src/features/simulation3d/metropolitanDemo.ts',
      import.meta.url,
    ),
    'utf8',
  ),
)
const reference = JSON.parse(
  fs.readFileSync(
    new URL('../../shared/example-request.json', import.meta.url),
    'utf8',
  ),
)
const results = []
assert.deepEqual(await (await fetch(baseURL + '/health')).json(), {
  status: 'ok',
})
const cases = [['Referencia', structuredClone(reference), 'optimal', 500]]
const closed = structuredClone(reference)
closed.roads[0].enabled = false
cases.push(['Cierre infactible', closed, 'infeasible', null])
const reduced = structuredClone(closed)
reduced.nodes[0].balance = 50
reduced.nodes[2].balance = -50
cases.push(['Cierre factible', reduced, 'optimal', 400])
const disabled = structuredClone(reference)
disabled.roads[2].enabled = false
cases.push(['Vía deshabilitada', disabled, 'optimal', 500])
for (const [i, scenario] of metropolitanDemo().scenarios.entries()) {
  cases.push(['Metropolitana ' + (i + 1), scenario, 'optimal', 1200])
}
for (const [name, scenario, status, cost] of cases) {
  const actual = await optimize(scenario)
  assert.equal(actual.status, status, name)
  assert.equal(actual.total_cost, cost, name)
  results.push({ caso: name, estado: actual.status, costo: actual.total_cost })
}
const invalid = structuredClone(reference)
invalid.nodes[0].balance = 99
await assert.rejects(() => optimize(invalid), /422/)
const outOfRange = {
  scenario_name: 'Límite numérico',
  nodes: Array.from({ length: 510 }, (_, i) => ({
    id: String(i),
    label: String(i),
    x: i,
    y: 0,
    balance: i === 0 ? 1 : i === 1 ? -1 : 0,
  })),
  roads: [
    {
      id: 'R',
      source: '0',
      target: '1',
      capacity: 1,
      unit_cost: Number.MAX_SAFE_INTEGER,
      enabled: true,
    },
  ],
}
await assert.rejects(() => optimize(outOfRange), /422.*510 nodos/)
for (const origin of [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]) {
  const response = await fetch(baseURL + '/optimize', {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('access-control-allow-origin'), origin)
}
const servedSchema = await (
  await fetch(new URL('/openapi.json', baseURL))
).json()
assert.deepEqual(
  servedSchema,
  JSON.parse(
    fs.readFileSync(
      new URL('../../shared/openapi.json', import.meta.url),
      'utf8',
    ),
  ),
)
console.table(results)
console.log(
  'Integración correcta: cliente REST real, 422, límite numérico, CORS y OpenAPI.',
)
