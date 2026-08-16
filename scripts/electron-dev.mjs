import { spawn } from 'node:child_process'

const vitePort = process.env.VITE_PORT ?? '5173'
const devUrl = `http://127.0.0.1:${vitePort}`
const syncPort = process.env.SYNC_PORT ?? '8790'
const syncHealthUrl = `http://127.0.0.1:${syncPort}/health`

const sync = spawn('node', ['scripts/sync-server.mjs'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, SYNC_PORT: syncPort },
})

const vite = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', vitePort], {
  stdio: 'inherit',
  shell: true,
})

await Promise.all([waitForUrl(devUrl), waitForUrl(syncHealthUrl)])

const electron = spawn('npx', ['electron', '.'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    ELECTRON_DEV: 'true',
    ELECTRON_DEV_URL: devUrl,
  },
})

electron.on('exit', (code) => {
  vite.kill()
  sync.kill()
  process.exit(code ?? 0)
})

process.on('SIGINT', () => {
  electron.kill()
  vite.kill()
  sync.kill()
  process.exit(0)
})

async function waitForUrl(url) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < 30_000) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch (_error) {
      // keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  throw new Error(`Timed out waiting for ${url}`)
}
