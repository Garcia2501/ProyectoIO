import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    // Leaflet + jsdom es lento en equipos cargados; evita falsos fallos por tiempo.
    testTimeout: 20000,
  },
}))
