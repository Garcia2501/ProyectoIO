import { useEffect, useState } from 'react'
import { VisualClock } from './visualClock'
import { useReducedMotion } from 'motion/react'
export function PlaybackControls({ clock }: { clock: VisualClock }) {
  const [value, setValue] = useState(() => clock.snapshot())
  const reduced = useReducedMotion()
  useEffect(() => {
    const update = () => setValue(clock.snapshot())
    const stop = clock.subscribe(update)
    const timer = setInterval(update, 250)
    return () => {
      stop()
      clearInterval(timer)
    }
  }, [clock])
  const time = (v: number) =>
    `${Math.floor(v / 60)
      .toString()
      .padStart(2, '0')}:${Math.floor(v % 60)
      .toString()
      .padStart(2, '0')}`
  return (
    <div
      className="mega-playback glass"
      role="group"
      aria-label="Reproducción visual"
    >
      <button
        className="play-circle"
        disabled={!!reduced}
        title={
          reduced
            ? 'Movimiento reducido: utiliza el progreso para explorar una imagen fija'
            : undefined
        }
        onClick={() => (value.playing ? clock.pause() : clock.play())}
        aria-label={
          value.playing ? 'Pausar reproducción' : 'Reanudar reproducción'
        }
      >
        {value.playing ? 'Ⅱ' : '▶'}
      </button>
      <button
        onClick={() => clock.restart()}
        aria-label="Reiniciar reproducción"
      >
        ↺
      </button>
      <label className="visual-progress">
        <span>
          {time(value.time)} <em>/ {time(clock.duration)} · tiempo visual</em>
        </span>
        <input
          aria-label="Progreso de reproducción"
          type="range"
          min="0"
          max={clock.duration}
          step=".1"
          value={value.time}
          onChange={(e) => clock.seek(Number(e.target.value))}
        />
      </label>
      <label className="speed-label">
        Velocidad
        <select
          aria-label="Velocidad visual"
          value={value.speed}
          onChange={(e) => clock.speed(Number(e.target.value))}
        >
          {[0.5, 1, 2, 4].map((v) => (
            <option key={v} value={v}>
              {v}×
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
