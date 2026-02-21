import type { LikeC4ViteConfig } from '#vite/config-app'
import { viteConfig } from '#vite/config-app'
import { viteWebcomponentConfig } from '#vite/config-webcomponent'
import { loggable } from '@likec4/log'
import getPort, { portNumbers } from 'get-port'
import isInsideContainer from 'is-inside-container'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { env } from 'std-env'
import k from 'tinyrainbow'
import type { SetOptional } from 'type-fest'
import type { ViteDevServer } from 'vite'
import { build, createServer } from 'vite'
import { mkTempPublicDir } from './utils'

type Config = SetOptional<LikeC4ViteConfig, 'likec4AssetsDir'> & {
  buildWebcomponent?: boolean
  openBrowser?: boolean
  hmr?: boolean
  listen?: string | undefined
  port?: number | undefined
  /** Port of the AI Agent server. Enables /agent/* proxy when set. */
  agentPort?: number | undefined
}

export async function viteDev({
  buildWebcomponent = true,
  hmr = true,
  webcomponentPrefix = 'likec4',
  title,
  languageServices,
  likec4AssetsDir,
  openBrowser,
  listen,
  port,
  agentPort,
  ...cfg
}: Config): Promise<ViteDevServer> {
  likec4AssetsDir ??= await mkdtemp(join(tmpdir(), '.likec4-assets-'))

  const { isDev, ...config } = await viteConfig({
    ...cfg,
    languageServices,
    likec4AssetsDir,
    webcomponentPrefix,
    title,
  })
  const logger = config.customLogger

  // if port not given as argument, try to get from env
  port ??= env['PORT'] ? parseInt(env['PORT'], 10) : undefined

  // if port is not specified, use default
  if (!port) {
    port = await getPort({
      port: [
        5173,
        5174,
        ...portNumbers(61000, 61010),
        ...portNumbers(62002, 62010),
      ],
    })
  }
  let hmrPort = 24678

  const publicDir = await mkTempPublicDir()

  const host = listen ?? (isInsideContainer() ? '0.0.0.0' : 'localhost')

  if (hmr) {
    hmrPort = await getPort({
      port: portNumbers(24678, 24690),
    })
    logger.info(`Enabling HMR: localhost:${hmrPort}`)
    if (isInsideContainer()) {
      logger.info(k.yellow(`ensure port ${hmrPort} is published from container`))
    }
  } else {
    logger.info(`Disabling HMR`)
  }

  const server = await createServer({
    ...config,
    define: hmr
      ? {
        ...config.define,
        'process.env.NODE_ENV': '"development"',
        AGENT_URL: agentPort ? '"/agent"' : '""',
        AGENT_ENABLED: agentPort ? 'true' : 'false',
      }
      : {
        ...config.define,
        AGENT_URL: '""',
        AGENT_ENABLED: 'false',
      },
    mode: hmr ? 'development' : config.mode,
    publicDir,
    server: {
      host,
      // TODO: temprorary enable access to any host
      // This is not recommended as it can be a security risk - https://vite.dev/config/server-options#server-allowedhosts
      // Enabled after request in discord support just to check if it solves the problem
      allowedHosts: true,
      port,
      hmr: hmr && {
        overlay: true,
        // needed for hmr to work over network aka WSL2
        // host,
        port: hmrPort,
      },
      fs: {
        strict: false,
      } as const,
      open: openBrowser ?? (!isDev && !isInsideContainer()),
      ...(agentPort && {
        proxy: {
          '/agent': {
            target: `http://localhost:${agentPort}`,
            changeOrigin: true,
          },
        },
      }),
    },
  })

  if (buildWebcomponent) {
    logger.info(`Building webcomponent`) // don't wait, we want to start the server asap
    viteWebcomponentConfig({
      webcomponentPrefix,
      languageServices: languageServices,
      outDir: publicDir,
      base: config.base,
    })
      .then(webcomponentConfig =>
        build({
          ...webcomponentConfig,
          logLevel: 'warn',
        })
      )
      .catch(err => {
        logger.warn(loggable(err))
        logger.warn('webcomponent build failed, ignoring error and continue')
      })
  } else {
    logger.info(`Skip webcomponent build`)
  }

  await server.listen()

  return server
}
