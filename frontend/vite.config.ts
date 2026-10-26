import react from '@vitejs/plugin-react'
import { appendFileSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

// The backend (`uv run api` in backend/) serves the data and the PMTiles basemap on port 8000.
const backend = 'http://127.0.0.1:8000'

const LICENSE_FILE = 'third-party-licenses.md'
const ROOT = fileURLToPath(new URL('.', import.meta.url))

function licenseText(dir: string): string {
  const file = readdirSync(dir).find((name) => /^(licen[cs]e|copying)/i.test(name))
  if (file) return readFileSync(join(dir, file), 'utf8').trim()
  // A few packages (murmurhash-js) publish only the licence name.
  const { license, author } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  const name = typeof author === 'string' ? author : author?.name
  return `${license}${name ? `, copyright ${name}` : ''}`
}

/**
 * build.license only sees packages whose own files are in the bundle. maplibre-gl ships its
 * dependencies pre-bundled in its dist/, pmtiles publishes no licence file, and the Hey API runtime
 * and Protomaps style are committed under src/; append their notices so the shipped file is
 * complete.
 */
function completeLicenses(): Plugin {
  return {
    name: 'complete-licenses',
    apply: 'build',
    writeBundle({ dir }) {
      if (!dir) return
      // pnpm keeps a package's dependencies next to it in the store, npm next to it at the top.
      const maplibre = realpathSync(join(ROOT, 'node_modules/maplibre-gl'))
      const { dependencies } = JSON.parse(readFileSync(join(maplibre, 'package.json'), 'utf8'))
      const sections = Object.keys(dependencies)
        .filter((name) => !name.startsWith('@types/'))
        .sort()
        .map((name) => {
          const pkgDir = join(dirname(maplibre), name)
          const { version } = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
          return `## ${name} - ${version} (bundled in maplibre-gl)\n\n${licenseText(pkgDir)}\n`
        })
      const notices = readFileSync(join(ROOT, '../THIRD_PARTY_NOTICES.md'), 'utf8').replace(/^# .*\n/, '')
      appendFileSync(join(dir, LICENSE_FILE), `\n${sections.join('\n')}\n${notices}`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), completeLicenses()],
  // maplibre-gl loads its worker with `new URL(..., import.meta.url)`, which breaks once Vite
  // pre-bundles the package into node_modules/.vite/deps ("Worker failed to load").
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  // The bundle ships MIT/ISC/BSD code whose notices the minifier strips; credits.html links this.
  build: {
    license: { fileName: LICENSE_FILE },
  },
  server: {
    proxy: {
      '/api': backend,
      '/tiles': backend,
    },
  },
})
