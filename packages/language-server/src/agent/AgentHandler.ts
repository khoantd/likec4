import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions'
import type { LikeC4LanguageServices } from '../LikeC4LanguageServices'
import { logger as mainLogger } from '../logger'
import type { AgentConfig, AgentTool, ChatMessage, ChatStreamEvent, Session, ViewContext } from './types'

const UPDATE_VIEW_CLIENT_TOOL = 'update_view'
const APPLY_FILE_EDIT_CLIENT_TOOL = 'apply_file_edit'

const logger = mainLogger.getChild('agent')

// Lazy runtime import — OpenAI SDK is only loaded when the agent is configured
type OpenAI = import('openai').OpenAI

function createLikeC4Tools(languageServices: LikeC4LanguageServices): AgentTool[] {
  return [
    {
      name: 'list_projects',
      description: 'List all LikeC4 projects available in the workspace',
      parameters: {
        type: 'object',
        properties: {},
      },
      async execute(_args) {
        const projects = languageServices.projects()
        return projects.map(p => ({
          id: p.id,
          title: p.title || p.id,
          documentCount: p.documents.length,
        }))
      },
    },
    {
      name: 'get_project_summary',
      description:
        'Get a summary of a LikeC4 project including all elements, views, and specification. Use this to understand the overall architecture.',
      parameters: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Project ID (optional, defaults to "default")',
          },
        },
      },
      async execute(args) {
        const projectId = (args['project'] as string | undefined) || undefined
        const model = await languageServices.computedModel(projectId as any)
        const elements = [...model.elements()]
        const views = [...model.views()]
        return {
          projectId: model.project.id,
          elementCount: elements.length,
          viewCount: views.length,
          elementKinds: [...new Set(elements.map(e => e.kind))],
          elements: elements.slice(0, 80).map(e => ({
            id: e.id,
            kind: e.kind,
            title: e.title,
            tags: [...e.tags],
          })),
          views: views.map(v => ({
            id: v.id,
            title: v.titleOrId,
            type: v.$view._type,
          })),
        }
      },
    },
    {
      name: 'search_elements',
      description: 'Search for LikeC4 elements by id, title, or kind. Returns matching elements with basic info.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (matches against element id, title, and kind)',
          },
          project: {
            type: 'string',
            description: 'Project ID (optional, defaults to "default")',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default: 20)',
          },
        },
        required: ['query'],
      },
      async execute(args) {
        const query = ((args['query'] as string) || '').toLowerCase()
        const projectId = (args['project'] as string | undefined) || undefined
        const limit = (args['limit'] as number | undefined) || 20
        const model = await languageServices.computedModel(projectId as any)
        return [...model.elements()]
          .filter(e =>
            e.id.toLowerCase().includes(query)
            || e.title.toLowerCase().includes(query)
            || e.kind.toLowerCase().includes(query)
          )
          .slice(0, limit)
          .map(e => ({
            id: e.id,
            kind: e.kind,
            title: e.title,
            description: e.description.text,
            tags: [...e.tags],
            childCount: [...e.children()].length,
          }))
      },
    },
    {
      name: 'read_element',
      description:
        'Get detailed information about a specific LikeC4 element by its FQN (fully qualified name). Includes relationships, children, and metadata.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Element FQN (e.g. "shop.frontend")',
          },
          project: {
            type: 'string',
            description: 'Project ID (optional, defaults to "default")',
          },
        },
        required: ['id'],
      },
      async execute(args) {
        const id = args['id'] as string
        const projectId = (args['project'] as string | undefined) || undefined
        const model = await languageServices.computedModel(projectId as any)
        const element = model.findElement(id)
        if (!element) {
          return { error: `Element "${id}" not found` }
        }
        return {
          id: element.id,
          name: element.name,
          kind: element.kind,
          title: element.title,
          description: element.description.text,
          technology: element.technology,
          tags: [...element.tags],
          metadata: element.getMetadata(),
          children: [...element.children()].map(c => ({ id: c.id, kind: c.kind, title: c.title })),
          relationships: {
            incoming: [...element.incoming()].map(r => ({
              from: r.source.id,
              fromTitle: r.source.title,
              kind: r.kind,
              label: r.title,
              technology: r.technology,
            })),
            outgoing: [...element.outgoing()].map(r => ({
              to: r.target.id,
              toTitle: r.target.title,
              kind: r.kind,
              label: r.title,
              technology: r.technology,
            })),
          },
        }
      },
    },
    {
      name: 'get_view',
      description: 'Get details of a specific LikeC4 view including its nodes and edges.',
      parameters: {
        type: 'object',
        properties: {
          viewId: {
            type: 'string',
            description: 'View ID',
          },
          project: {
            type: 'string',
            description: 'Project ID (optional, defaults to "default")',
          },
        },
        required: ['viewId'],
      },
      async execute(args) {
        const viewId = args['viewId'] as string
        const projectId = (args['project'] as string | undefined) || undefined
        const model = await languageServices.computedModel(projectId as any)
        const view = model.findView(viewId as any)
        if (!view) {
          return { error: `View "${viewId}" not found` }
        }
        const v = view.$view
        return {
          id: v.id,
          title: view.titleOrId,
          type: v._type,
          nodeCount: v.nodes.length,
          edgeCount: v.edges.length,
          nodes: v.nodes.slice(0, 50).map((n: any) => ({
            id: n.id,
            kind: n.kind,
            title: n.title,
          })),
          edges: v.edges.slice(0, 50).map((e: any) => ({
            from: e.source,
            to: e.target,
            label: e.label,
          })),
        }
      },
    },
    {
      name: 'find_relationships',
      description: 'Find relationships between two elements, including indirect paths.',
      parameters: {
        type: 'object',
        properties: {
          element1: {
            type: 'string',
            description: 'First element FQN',
          },
          element2: {
            type: 'string',
            description: 'Second element FQN',
          },
          project: {
            type: 'string',
            description: 'Project ID (optional)',
          },
        },
        required: ['element1', 'element2'],
      },
      async execute(args) {
        const id1 = args['element1'] as string
        const id2 = args['element2'] as string
        const projectId = (args['project'] as string | undefined) || undefined
        const model = await languageServices.computedModel(projectId as any)

        const el1 = model.findElement(id1)
        const el2 = model.findElement(id2)

        if (!el1) return { error: `Element "${id1}" not found` }
        if (!el2) return { error: `Element "${id2}" not found` }

        const directFrom1to2 = [...el1.outgoing()].filter(r => r.target.id === id2)
        const directFrom2to1 = [...el2.outgoing()].filter(r => r.target.id === id1)

        return {
          element1: { id: el1.id, title: el1.title },
          element2: { id: el2.id, title: el2.title },
          relationships: {
            from1to2: directFrom1to2.map(r => ({ kind: r.kind, label: r.title, technology: r.technology })),
            from2to1: directFrom2to1.map(r => ({ kind: r.kind, label: r.title, technology: r.technology })),
          },
          hasDirectRelationship: directFrom1to2.length > 0 || directFrom2to1.length > 0,
        }
      },
    },
    // Client-only tool: apply DSL edits to a specific source file
    {
      name: APPLY_FILE_EDIT_CLIENT_TOOL,
      description:
        'Apply a DSL edit to a specific source file in the user\'s editor. Use this to create or update a LikeC4 source file with new or modified DSL content. Requires the filename and the full new content of the file.',
      parameters: {
        type: 'object',
        properties: {
          filename: {
            type: 'string',
            description: 'The target filename (e.g. "model.c4" or "views.c4")',
          },
          content: {
            type: 'string',
            description: 'The full new content of the file (LikeC4 DSL)',
          },
        },
        required: ['filename', 'content'],
      },
      async execute() {
        // Not executed on server; client handles via client_tool_call
        return { clientOnly: true }
      },
    },
    // Client-only tool: forwarded to the frontend to apply via likec4rpc.updateView
    {
      name: UPDATE_VIEW_CLIENT_TOOL,
      description:
        'Apply a change to the current diagram view. Use this to update element styles (color, shape, border, opacity), reset manual layout to auto, or change auto-layout direction. The change is applied in the user\'s editor. Requires projectId and viewId from context.',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID (e.g. "default")',
          },
          viewId: {
            type: 'string',
            description: 'View ID (e.g. "index")',
          },
          change: {
            type: 'object',
            description:
              'View change. One of: change-element-style (style, targets), reset-manual-layout (op only), change-autolayout (layout.direction: TB|BT|LR|RL, optional nodeSep, rankSep).',
            properties: {
              op: {
                type: 'string',
                enum: ['change-element-style', 'reset-manual-layout', 'change-autolayout'],
              },
              style: {
                type: 'object',
                description:
                  'For change-element-style: border (solid|dashed|dotted), opacity (0-1), shape (rounded|hexagon|cylinder|person|browser), color (primary|secondary|accent|neutral|success|warning|danger|muted).',
                properties: {
                  border: { type: 'string', enum: ['solid', 'dashed', 'dotted'] },
                  opacity: { type: 'number' },
                  shape: { type: 'string', enum: ['rounded', 'hexagon', 'cylinder', 'person', 'browser'] },
                  color: {
                    type: 'string',
                    enum: ['primary', 'secondary', 'accent', 'neutral', 'success', 'warning', 'danger', 'muted'],
                  },
                },
              },
              targets: {
                type: 'array',
                description: 'For change-element-style: element FQNs to apply the style to.',
                items: { type: 'string' },
              },
              layout: {
                type: 'object',
                description: 'For change-autolayout: direction (TB|BT|LR|RL), optional nodeSep, rankSep.',
                properties: {
                  direction: { type: 'string', enum: ['TB', 'BT', 'LR', 'RL'] },
                  nodeSep: { type: 'number' },
                  rankSep: { type: 'number' },
                },
              },
            },
            required: ['op'],
          },
        },
        required: ['projectId', 'viewId', 'change'],
      },
      async execute() {
        // Not executed on server; client handles via client_tool_call
        return { clientOnly: true }
      },
    },
  ]
}

function toolsToOpenAIFormat(tools: AgentTool[]): ChatCompletionTool[] {
  return tools.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters as any,
    },
  }))
}

export class AgentHandler {
  private sessions = new Map<string, Session>()
  private openai!: OpenAI
  private builtinTools: AgentTool[]
  private isInitialized = false

  constructor(
    private config: AgentConfig,
    private languageServices: LikeC4LanguageServices,
  ) {
    this.builtinTools = createLikeC4Tools(languageServices)
  }

  private async init() {
    if (this.isInitialized) return
    const { default: OpenAI } = await import('openai')
    this.openai = new OpenAI({
      baseURL: this.config.url,
      apiKey: this.config.apiKey || 'no-key',
    })
    this.isInitialized = true
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id)
  }

  deleteSession(id: string): boolean {
    return this.sessions.delete(id)
  }

  private getOrCreateSession(id: string): Session {
    let session = this.sessions.get(id)
    if (!session) {
      session = {
        id,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      this.sessions.set(id, session)
    }
    return session
  }

  private buildSystemPrompt(context: ViewContext): string {
    const contextParts: string[] = []
    if (context.projectId) contextParts.push(`Project: ${context.projectId}`)
    if (context.viewId) contextParts.push(`Current view: ${context.viewId}`)
    if (context.selectedElementId) contextParts.push(`Selected element: ${context.selectedElementId}`)

    const contextSection = contextParts.length > 0
      ? `\n\nCurrent context:\n${contextParts.map(p => `- ${p}`).join('\n')}`
      : ''

    let filesSection = ''
    if (context.files && Object.keys(context.files).length > 0) {
      const fileBlocks = Object.entries(context.files)
        .map(([filename, content]) => `### ${filename}\n\`\`\`likec4\n${content}\n\`\`\``)
        .join('\n\n')
      filesSection = `\n\nCurrent source files:\n${fileBlocks}`
    } else if (context.currentDsl) {
      filesSection = `\n\nCurrent DSL:\n\`\`\`likec4\n${context.currentDsl}\n\`\`\``
    }

    if (this.config.systemPrompt) {
      return this.config.systemPrompt + contextSection + filesSection
    }

    return `You are an AI assistant integrated into LikeC4, an architecture-as-code tool.
You help users understand, analyze, and improve their software architecture diagrams.

You have access to tools for querying the LikeC4 model:
- list_projects: List all projects
- get_project_summary: Get overview of elements and views in a project
- search_elements: Search elements by name, kind, or description
- read_element: Get full details of a specific element including relationships
- get_view: Get details of a specific diagram view
- find_relationships: Find relationships between two elements
- update_view: Apply a change to the diagram (element styles, reset layout, auto-layout direction). Use when the user asks to change colors, shapes, or layout. Requires projectId and viewId from context.
- apply_file_edit: Apply DSL edits to a specific source file. Use this when the user asks to modify, add, or rewrite source files.

Guidelines:
- Always use tools to get accurate data before answering
- When referring to elements, use their FQN (fully qualified name)
- Be concise and technical in your responses
- Suggest relevant next steps or related elements when helpful
- When editing DSL, use apply_file_edit with the exact filename shown in the source files section${contextSection}${filesSection}`
  }

  private buildMessages(session: Session, context: ViewContext): ChatCompletionMessageParam[] {
    const systemMessage: ChatCompletionMessageParam = {
      role: 'system',
      content: this.buildSystemPrompt(context),
    }

    const historyMessages: ChatCompletionMessageParam[] = session.messages.map(m => ({
      role: m.role,
      content: m.content,
    }))

    return [systemMessage, ...historyMessages]
  }

  async *streamChat(
    sessionId: string,
    userMessage: string,
    context: ViewContext,
    extraTools: AgentTool[] = [],
  ): AsyncGenerator<ChatStreamEvent> {
    await this.init()

    const session = this.getOrCreateSession(sessionId)
    session.messages.push({ role: 'user', content: userMessage, timestamp: new Date() })
    session.updatedAt = new Date()

    const allTools = [...this.builtinTools, ...extraTools]
    const openAITools = toolsToOpenAIFormat(allTools)
    const toolMap = new Map(allTools.map(t => [t.name, t]))

    const messages = this.buildMessages(session, context)

    // Agentic loop: continue until no more tool calls
    let loopCount = 0
    const maxLoops = 10

    while (loopCount < maxLoops) {
      loopCount++
      let assistantText = ''
      const pendingToolCalls: Array<{
        id: string
        name: string
        argsJson: string
      }> = []

      try {
        const stream = await this.openai.chat.completions.create({
          model: this.config.model,
          messages,
          ...(openAITools.length > 0 && { tools: openAITools }),
          stream: true,
        })

        let finishReason: string | null = null

        for await (const chunk of stream) {
          const choice = chunk.choices[0]
          if (!choice) continue

          const delta = choice.delta

          // Accumulate text
          if (delta.content) {
            assistantText += delta.content
            yield { type: 'text_delta', sessionId, delta: delta.content }
          }

          // Accumulate tool calls
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index
              if (!pendingToolCalls[idx]) {
                pendingToolCalls[idx] = { id: tc.id || '', name: tc.function?.name || '', argsJson: '' }
              }
              if (tc.id) pendingToolCalls[idx]!.id = tc.id
              if (tc.function?.name) pendingToolCalls[idx]!.name = tc.function.name
              if (tc.function?.arguments) pendingToolCalls[idx]!.argsJson += tc.function.arguments
            }
          }

          if (choice.finish_reason) {
            finishReason = choice.finish_reason
          }
        }

        if (finishReason === 'stop' || finishReason === 'length') {
          // Assistant is done
          if (assistantText) {
            session.messages.push({ role: 'assistant', content: assistantText, timestamp: new Date() })
            session.updatedAt = new Date()
          }
          yield { type: 'done', sessionId }
          return
        }

        if (finishReason === 'tool_calls' || pendingToolCalls.length > 0) {
          // Add assistant message with tool_calls to messages
          const toolCallsForMsg = pendingToolCalls.filter(Boolean).map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: tc.argsJson },
          }))

          messages.push({
            role: 'assistant',
            content: assistantText || null,
            tool_calls: toolCallsForMsg,
          })

          // Execute each tool call (or forward client-only tools)
          for (const tc of pendingToolCalls.filter(Boolean)) {
            const tool = toolMap.get(tc.name)
            let toolArgs: Record<string, unknown> = {}
            try {
              toolArgs = JSON.parse(tc.argsJson || '{}')
            } catch {}

            yield { type: 'tool_call', toolName: tc.name, toolInput: toolArgs }

            let toolResult: unknown
            if (tc.name === UPDATE_VIEW_CLIENT_TOOL || tc.name === APPLY_FILE_EDIT_CLIENT_TOOL) {
              // Forward to client; do not execute on server
              yield { type: 'client_tool_call', toolName: tc.name, toolInput: toolArgs }
              toolResult = { success: true, message: 'Change sent to the editor.' }
            } else if (!tool) {
              toolResult = { error: `Unknown tool: ${tc.name}` }
            } else {
              try {
                toolResult = await tool.execute(toolArgs)
              } catch (err) {
                toolResult = { error: err instanceof Error ? err.message : String(err) }
              }
            }

            yield { type: 'tool_result', toolName: tc.name, result: toolResult }

            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify(toolResult),
            })
          }

          // Continue the loop to get the next response
          continue
        }

        // If we got here with no finish reason, something unexpected happened
        yield { type: 'done', sessionId }
        return
      } catch (err) {
        logger.error('AgentHandler streaming error', { err })
        yield {
          type: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
          code: 'STREAM_ERROR',
        }
        return
      }
    }

    // Max loops reached
    yield {
      type: 'error',
      message: 'Maximum tool call iterations reached',
      code: 'MAX_LOOPS',
    }
  }
}
