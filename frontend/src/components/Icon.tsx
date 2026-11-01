import type { CSSProperties } from 'react'
const paths: Record<string, string> = {
  network: 'M12 3v6M5 19l7-10 7 10M5 19h.01M19 19h.01',
  road: 'M6 3 2 21M18 3l4 18M12 3v4m0 4v4m0 4v2',
  layers: 'm12 3 10 5-10 5L2 8l10-5Zm-10 10 10 5 10-5M2 18l10 5 10-5',
  chart: 'M4 20v-6h3v6M11 20V9h3v11M18 20V3h3v17',
  cost: 'M20 6c0 2-4 3-8 3S4 8 4 6s4-3 8-3 8 1 8 3ZM4 6v12c0 2 4 3 8 3s8-1 8-3V6M4 12c0 2 4 3 8 3s8-1 8-3',
  check: 'm5 12 4 4L20 5',
  reset: 'M3 10a9 9 0 1 1 1 9M3 3v7h7',
  edit: 'm4 16 12-12 4 4L8 20H4v-4Z',
  plus: 'M12 4v16M4 12h16',
  trash: 'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  play: 'm8 4 12 8-12 8V4Z',
  cursor: 'm5 3 14 10-7 1-3 7L5 3Z',
  grid: 'M3 3h18v18H3V3Zm6 0v18m6-18v18M3 9h18M3 15h18',
  node: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  info: 'M12 11v6m0-10h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  activity: 'M2 12h5l3-9 4 18 3-9h5',
  save: 'M5 3h12l4 4v14H3V3h2Zm2 0v6h10V3M7 21v-8h10v8',
  close: 'm6 6 12 12M6 18 18 6',
}
export function Icon({
  name,
  size = 20,
  style,
}: {
  name: string
  size?: number
  style?: CSSProperties
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <path d={paths[name] || paths.info} />
    </svg>
  )
}
