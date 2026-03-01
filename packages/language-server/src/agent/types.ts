export interface AgentConfig {
  /** LiteLLM proxy base URL (OpenAI-compatible) */
  url: string
  /** API key (optional) */
  apiKey?: string | undefined
  /** Model name, e.g. "gpt-4o" */
  model: string
  /** Custom system prompt (optional) */
  systemPrompt?: string | undefined
}

export interface ViewContext {
  projectId?: string | undefined
  viewId?: string | undefined
  selectedElementId?: string | undefined
  currentDsl?: string | undefined
  files?: Record<string, string> | undefined
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface Session {
  id: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
}

// SSE stream event types

export interface TextDeltaEvent {
  type: 'text_delta'
  sessionId: string
  delta: string
}

export interface ToolCallEvent {
  type: 'tool_call'
  toolName: string
  toolInput?: Record<string, unknown>
}

/** Emitted when the agent requests a tool to be run on the client (e.g. update_view) */
export interface ClientToolCallEvent {
  type: 'client_tool_call'
  toolName: string
  toolInput?: Record<string, unknown>
}

export interface ToolResultEvent {
  type: 'tool_result'
  toolName: string
  result?: unknown
}

export interface DoneEvent {
  type: 'done'
  sessionId: string
  usage?: {
    promptTokens: number
    completionTokens: number
  }
}

export interface ErrorEvent {
  type: 'error'
  message: string
  code?: string
}

export type ChatStreamEvent =
  | TextDeltaEvent
  | ToolCallEvent
  | ClientToolCallEvent
  | ToolResultEvent
  | DoneEvent
  | ErrorEvent

// Skills and Plugins

export interface Skill {
  id: string
  title: string
  description?: string | undefined
  /** Tabler icon name */
  icon?: string | undefined
  /** Which context fields must be present for this skill to be available */
  requiresContext?: Array<'projectId' | 'viewId' | 'selectedElementId'> | undefined
  /** Generates the user message for this skill invocation */
  buildPrompt(context: ViewContext, params?: Record<string, unknown>): string
}

export interface AgentTool {
  name: string
  description: string
  /** JSON Schema for the tool parameters */
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
  execute(args: Record<string, unknown>): Promise<unknown>
}

export interface Plugin {
  id: string
  name: string
  description?: string | undefined
  source: 'builtin' | 'mcp' | 'custom'
  tools: AgentTool[]
}
