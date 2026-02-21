import { AgentServer, DEFAULT_AGENT_PORT } from '@likec4/language-server/agent'
import { fromWorkspace } from '@likec4/language-services/node/without-mcp'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { printServerUrls } from '../../vite/printServerUrls'
import { viteDev } from '../../vite/vite-dev'

type HandlerParams = {
  /**
   * The directory where c4 files are located.
   */
  path: string
  useDotBin: boolean
  /**
   * base url the app is being served from
   * @default '/'
   */
  base?: string | undefined

  useHashHistory: boolean | undefined

  webcomponentPrefix: string

  /*
   * base title of the app pages
   */
  title: string | undefined

  /**
   * ip address of the network interface to listen on
   * @default '127.0.0.1'
   */
  listen?: string | undefined

  /**
   * port number for the dev server
   * @default 5173
   */
  port?: number | undefined

  /**
   * Enable webcomponent build
   * @default true
   */
  enableWebcomponent?: boolean | undefined

  /**
   * Enable HMR
   * @default true
   */
  enableHMR?: boolean | undefined
}

export async function handler({
  path,
  useDotBin,
  webcomponentPrefix,
  title,
  useHashHistory,
  enableWebcomponent = true,
  enableHMR = true,
  base,
  listen,
  port,
}: HandlerParams) {
  // Load .env file: try workspace dir first, then cwd as fallback
  for (const candidate of [join(path, '.env'), join(process.cwd(), '.env')]) {
    try {
      process.loadEnvFile(candidate)
      break
    } catch {
      // .env file is optional
    }
  }

  // Explicitly set NODE_ENV to development
  if (enableHMR) {
    process.env['NODE_ENV'] = 'development'
  }
  const languageServices = await fromWorkspace(path, {
    // logger: 'vite',
    graphviz: useDotBin ? 'binary' : 'wasm',
    watch: enableHMR,
  })
  const likec4AssetsDir = await mkdtemp(join(tmpdir(), '.likec4-assets-'))

  // Start AI Agent server if configured via environment variables
  const agentUrl = process.env['LIKEC4_AGENT_URL']
  let agentPort: number | undefined

  if (agentUrl) {
    const agentApiKey = process.env['LIKEC4_AGENT_KEY']
    const agentModel = process.env['LIKEC4_AGENT_MODEL'] || 'gpt-4o'
    agentPort = process.env['LIKEC4_AGENT_PORT']
      ? parseInt(process.env['LIKEC4_AGENT_PORT'], 10)
      : DEFAULT_AGENT_PORT

    const agentServer = new AgentServer(
      {
        url: agentUrl,
        apiKey: agentApiKey,
        model: agentModel,
      },
      languageServices.languageServices,
    )
    await agentServer.start(agentPort)
  }

  const server = await viteDev({
    buildWebcomponent: enableWebcomponent,
    hmr: enableHMR,
    base,
    webcomponentPrefix,
    title,
    languageServices,
    useHashHistory,
    likec4AssetsDir,
    listen,
    port,
    agentPort,
  })

  server.config.logger.clearScreen('info')
  printServerUrls(server)
}
