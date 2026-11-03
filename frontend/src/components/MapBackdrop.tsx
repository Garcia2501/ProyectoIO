import { useId } from 'react'
export function MapBackdrop() {
  const id = useId()
  return (
    <svg
      className="map-backdrop"
      viewBox="0 0 1200 600"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id={id}
          width="85"
          height="75"
          patternTransform="rotate(-25)"
          patternUnits="userSpaceOnUse"
        >
          <rect width="85" height="75" fill="#edf2f4" />
          <path
            d="M0 0H85V75H0Z M0 25H85M32 0V75M60 0V75M0 50H85"
            fill="none"
            stroke="white"
            strokeWidth="2"
          />
          <rect x="35" y="28" width="22" height="19" fill="#d9eedc" rx="2" />
        </pattern>
      </defs>
      <rect width="1200" height="600" fill={'url(#' + id + ')'} />
      <path
        d="M-80 600C170 240 250 600 450 290S620 150 760 160 920 10 1300 210"
        stroke="#c5e9f2"
        strokeWidth="27"
        fill="none"
      />
      <g fill="none" stroke="#fff" strokeWidth="8">
        <path d="M-50 150 300 50 650 600M30 630 280 280 800 20M500 650 750 320 1230 380M1000-50 850 250 1250 530" />
        <path d="M-50 450Q400 250 580 280T1250 50M100-30Q400 350 1250 620" />
      </g>
      <g fill="#d2ecd4" opacity=".65">
        <path d="m60 40 100-20 35 80-90 40Z" />
        <path d="m950 410 100-40 60 110-120 40Z" />
        <path d="m450 30 70-20 40 50-80 20Z" />
      </g>
    </svg>
  )
}
