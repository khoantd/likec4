import { existsSync, writeFileSync } from 'node:fs'
import { platform } from 'node:os'
import { $ as _$, quotePowerShell, usePowerShell } from 'zx'

const isWindows = platform() === 'win32'
// On Windows, zx needs PowerShell (no bash by default in v8+)
if (isWindows) {
  usePowerShell()
}
const $ = _$({
  stdio: 'inherit',
  preferLocal: true,
  ...(isWindows ? { quote: quotePowerShell } : {}),
})

await $`tsr generate`

const envTemplate = `
OAUTH_GITHUB_ID=""
OAUTH_GITHUB_SECRET=""
SESSION_ENCRYPTION_KEY="VFRAdSem81cuALVeOMC4PJyLXf30tckV"
`

if (!existsSync('.env')) {
  writeFileSync(
    '.env',
    envTemplate,
  )
}
if (!existsSync('.dev.vars')) {
  writeFileSync(
    '.dev.vars',
    envTemplate,
  )
}

const buildForVercel = process.env['VERCEL'] === '1'
if (buildForVercel) {
  // On Vercel we only build the static frontend; skip wrangler and use a stub
  // so generate succeeds and worker-configuration.d.ts exists for turbo outputs.
  const workerConfigStub = `// Stub for Vercel build (worker not deployed here). Replaced by \`wrangler types\` locally.
declare namespace Cloudflare {
  interface Env {
    KV: unknown
    ASSETS?: unknown
    OAUTH_GITHUB_ID: string
    OAUTH_GITHUB_SECRET: string
    SESSION_ENCRYPTION_KEY: string
  }
}
interface Env extends Cloudflare.Env {}
`
  writeFileSync('worker-configuration.d.ts', workerConfigStub)
} else {
  await $`wrangler types`
}
