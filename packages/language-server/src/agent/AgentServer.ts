import type { ServerType } from '@hono/node-server'
import { serve } from '@hono/node-server'
import { loggable } from '@likec4/log'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import { randomUUID } from 'node:crypto'
import type { LikeC4LanguageServices } from '../LikeC4LanguageServices'
import { logger as mainLogger } from '../logger'
import { AgentHandler } from './AgentHandler'
import { SkillsRegistry } from './SkillsRegistry'
import type { AgentConfig, ViewContext } from './types'

const logger = mainLogger.getChild('agent')

export const DEFAULT_AGENT_PORT = 33336

export class AgentServer {
  private server: ServerType | undefined
  private handler: AgentHandler
  private skillsRegistry: SkillsRegistry
  private _port = DEFAULT_AGENT_PORT

  constructor(
    private config: AgentConfig,
    private languageServices: LikeC4LanguageServices,
  ) {
    this.handler = new AgentHandler(config, languageServices)
    this.skillsRegistry = new SkillsRegistry()
  }

  get port() {
    return this._port
  }

  get isStarted() {
    return this.server?.listening === true
  }

  /** Access the skills registry to register custom skills or plugins */
  get skills(): SkillsRegistry {
    return this.skillsRegistry
  }

  async start(port = this._port): Promise<void> {
    if (this.server) {
      if (this._port === port) return
      await this.stop()
    }

    this._port = port
    const app = this.createApp()

    return new Promise((resolve, reject) => {
      const srv = serve({
        fetch: app.fetch,
        hostname: '0.0.0.0',
        port,
      })
        .prependOnceListener('error', reject)
        .prependOnceListener('listening', () => {
          srv.removeListener('error', reject)
          this.server = srv.unref()
          logger.info('AI Agent server ready at http://0.0.0.0:{port}', { port })
          resolve()
        })
    })
  }

  stop(): Promise<void> {
    const server = this.server
    if (!server) return Promise.resolve()
    this.server = undefined
    logger.info('Stopping AI Agent server')
    return new Promise((resolve) => {
      server.close((err) => {
        if (err) logger.error('Failed to stop Agent server', { err })
        resolve()
      })
    })
  }

  private createApp(): Hono {
    const app = new Hono()
    const { handler, skillsRegistry, config } = this

    app.use(
      '*',
      cors({
        origin: '*',
        allowHeaders: ['Content-Type'],
        allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      }),
    )

    // Health check
    app.get('/health', c =>
      c.json({
        status: 'ok',
        model: config.model,
      }))

    // POST /agent/chat — stream a chat response
    app.post('/agent/chat', async (c) => {
      let body: { message?: string; sessionId?: string; context?: ViewContext }
      try {
        body = await c.req.json()
      } catch {
        return c.json({ error: 'Invalid JSON body' }, 400)
      }

      const message = body.message?.trim()
      if (!message) {
        return c.json({ error: '"message" field is required' }, 400)
      }

      const sessionId = body.sessionId || randomUUID()
      const context: ViewContext = body.context || {}

      return streamSSE(c, async (stream) => {
        try {
          for await (
            const event of handler.streamChat(sessionId, message, context, skillsRegistry.getAllPluginTools())
          ) {
            await stream.writeSSE({
              data: JSON.stringify(event),
            })
          }
        } catch (err) {
          logger.error('Error streaming chat response', { err: loggable(err) })
          await stream.writeSSE({
            data: JSON.stringify({ type: 'error', message: 'Internal server error', code: 'INTERNAL_ERROR' }),
          })
        }
      })
    })

    // GET /agent/sessions/:id — get session history
    app.get('/agent/sessions/:id', (c) => {
      const id = c.req.param('id')
      const session = handler.getSession(id)
      if (!session) {
        return c.json({ error: `Session "${id}" not found` }, 404)
      }
      return c.json(session)
    })

    // DELETE /agent/sessions/:id — clear a session
    app.delete('/agent/sessions/:id', (c) => {
      const id = c.req.param('id')
      const deleted = handler.deleteSession(id)
      if (!deleted) {
        return c.json({ error: `Session "${id}" not found` }, 404)
      }
      return new Response(null, { status: 204 })
    })

    // GET /agent/skills — list all skills
    app.get('/agent/skills', (c) => {
      const skills = skillsRegistry.listSkills().map(s => ({
        id: s.id,
        title: s.title,
        description: s.description,
        icon: s.icon,
        requiresContext: s.requiresContext,
      }))
      return c.json({ skills })
    })

    // POST /agent/skills/:id/invoke — invoke a skill
    app.post('/agent/skills/:id/invoke', async (c) => {
      const skillId = c.req.param('id')
      const skill = skillsRegistry.getSkill(skillId)
      if (!skill) {
        return c.json({ error: `Skill "${skillId}" not found` }, 404)
      }

      let body: { sessionId?: string; context?: ViewContext; params?: Record<string, unknown> }
      try {
        body = await c.req.json()
      } catch {
        body = {}
      }

      const context: ViewContext = body.context || {}
      const sessionId = body.sessionId || randomUUID()
      const prompt = skill.buildPrompt(context, body.params)

      return streamSSE(c, async (stream) => {
        try {
          for await (
            const event of handler.streamChat(sessionId, prompt, context, skillsRegistry.getAllPluginTools())
          ) {
            await stream.writeSSE({
              data: JSON.stringify(event),
            })
          }
        } catch (err) {
          logger.error('Error streaming skill response', { err: loggable(err) })
          await stream.writeSSE({
            data: JSON.stringify({ type: 'error', message: 'Internal server error', code: 'INTERNAL_ERROR' }),
          })
        }
      })
    })

    // GET /agent/plugins — list registered plugins
    app.get('/agent/plugins', (c) => {
      const plugins = skillsRegistry.listPlugins().map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        source: p.source,
        tools: p.tools.map(t => ({
          name: t.name,
          description: t.description,
        })),
      }))

      // Also include built-in plugin info
      const builtinPlugin = {
        id: 'likec4-builtin',
        name: 'LikeC4 Built-in Tools',
        description: 'Core tools for querying the LikeC4 architecture model',
        source: 'builtin',
        tools: [
          { name: 'list_projects', description: 'List all LikeC4 projects' },
          { name: 'get_project_summary', description: 'Get project overview with elements and views' },
          { name: 'search_elements', description: 'Search elements by name, kind, or description' },
          { name: 'read_element', description: 'Get full details of a specific element' },
          { name: 'get_view', description: 'Get details of a specific diagram view' },
          { name: 'find_relationships', description: 'Find relationships between two elements' },
        ],
      }

      return c.json({ plugins: [builtinPlugin, ...plugins] })
    })

    app.notFound(c => c.json({ error: 'Not found' }, 404))

    app.onError((err, c) => {
      logger.error('Agent server error', { err: loggable(err) })
      return c.json({ error: 'Internal server error' }, 500)
    })

    return app
  }
}
