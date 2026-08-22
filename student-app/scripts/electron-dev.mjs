import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const port = process.env.STUDENT_VITE_PORT ?? '5174'
const url = `http://127.0.0.1:${port}`
const vite = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', port], { stdio: 'inherit', shell: true })

const startedAt = Date.now()
while (Date.now() - startedAt < 30_000) {
  try { const response = await fetch(url); if (response.ok) break } catch (_error) { /* wait */ }
  await new Promise(resolve => setTimeout(resolve, 300))
}

const electronExecutable = process.platform === 'win32'
  ? resolve('node_modules', 'electron', 'dist', 'electron.exe')
  : resolve('node_modules', '.bin', 'electron')
const electron = spawn(electronExecutable, ['.'], { stdio: 'inherit', shell: false, env: { ...process.env, ELECTRON_DEV: 'true', ELECTRON_DEV_URL: url } })
electron.on('exit', code => { vite.kill(); process.exit(code ?? 0) })
process.on('SIGINT', () => { electron.kill(); vite.kill(); process.exit(0) })
