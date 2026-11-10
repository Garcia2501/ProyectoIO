/**
 * Carga de los insumos cartográficos versionados en data/geography/.
 *
 * Los archivos los entrega el equipo GIS. Si todavía no existen, la interfaz
 * muestra el estado «datos cartográficos pendientes»; nunca se sustituyen por
 * geometrías inventadas.
 */
import type { Scenario } from '../../types/network'
import { parseGeoNetwork } from './geo'
import type { GeoNetwork } from './geo'
import { huachiScenarios, parseSeed } from './scenarios'
import type { ScenarioSeed } from './scenarios'

export const REQUIRED_FILES = [
  'huachi_roads.geojson',
  'huachi_nodes.geojson',
] as const
export const OPTIONAL_FILES = [
  'huachi_scenario_seed.json',
  'provenance.json',
] as const

export interface Provenance {
  source?: string
  extractedAt?: string
  license?: string
  notes: string[]
}

export type HuachiData =
  | { status: 'pending'; missing: string[] }
  | { status: 'invalid'; errors: string[] }
  | {
      status: 'ready'
      network: GeoNetwork
      warnings: string[]
      seed: ScenarioSeed | null
      seedErrors: string[]
      scenarios: Scenario[] | null
      provenance: Provenance | null
    }

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined)

function parseProvenance(json: unknown): Provenance | null {
  if (typeof json !== 'object' || json === null) return null
  const p = json as Record<string, unknown>
  const notes = [p.notes, p.quality_warnings, p.warnings]
    .flatMap((v) => (Array.isArray(v) ? v : v ? [v] : []))
    .map(String)
  return {
    source: str(p.source) ?? str(p.origin),
    extractedAt: str(p.extracted_at) ?? str(p.extraction_date),
    license: str(p.license),
    notes,
  }
}

/** `files` mapea nombre de archivo → contenido de texto. */
export function loadHuachiData(files: Record<string, string>): HuachiData {
  const missing = REQUIRED_FILES.filter((name) => !(name in files))
  if (missing.length === REQUIRED_FILES.length)
    return { status: 'pending', missing: [...missing] }
  if (missing.length)
    return {
      status: 'invalid',
      errors: [`Falta ${missing.join(' y ')}: el dataset está incompleto.`],
    }
  const parse = (name: string): unknown => {
    try {
      return JSON.parse(files[name])
    } catch {
      throw new Error(`${name}: JSON inválido.`)
    }
  }
  try {
    const { network, errors, warnings } = parseGeoNetwork(
      parse('huachi_nodes.geojson'),
      parse('huachi_roads.geojson'),
    )
    if (!network) return { status: 'invalid', errors }
    let seed: ScenarioSeed | null = null
    let seedErrors: string[] = []
    if ('huachi_scenario_seed.json' in files) {
      const result = parseSeed(parse('huachi_scenario_seed.json'), network)
      seed = result.seed
      seedErrors = result.errors
    }
    return {
      status: 'ready',
      network,
      warnings,
      seed,
      seedErrors,
      scenarios: seed ? huachiScenarios(network, seed) : null,
      provenance:
        'provenance.json' in files
          ? parseProvenance(parse('provenance.json'))
          : null,
    }
  } catch (error) {
    return { status: 'invalid', errors: [(error as Error).message] }
  }
}

const bundled = import.meta.glob('../../../../data/geography/*', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export function bundledFiles(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(bundled).map(([path, content]) => [
      path.split('/').pop()!,
      content,
    ]),
  )
}

export const huachiData: HuachiData = loadHuachiData(bundledFiles())
