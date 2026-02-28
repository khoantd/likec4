import { atom, computed } from 'nanostores'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** Tool calls in progress shown as indicators */
  toolCalls?: string[]
  timestamp: Date
}

export interface AgentViewContext {
  projectId?: string | undefined
  viewId?: string | undefined
  selectedElementId?: string | undefined
  currentDsl?: string | undefined
}

export interface SkillInfo {
  id: string
  title: string
  description?: string | undefined
  icon?: string | undefined
  requiresContext?: Array<'projectId' | 'viewId' | 'selectedElementId'> | undefined
}

// --- Agent availability ---

/** True when agent is configured and URL is not the same origin (avoid POST to static site). */
type AgentBackend = 'diagram-api' | 'node-agent' | 'none'

function getBackend(): AgentBackend {
  // AI_BACKEND is injected by Vite define in vite.config.ts
  return (AI_BACKEND ?? 'none') as AgentBackend
}

export function isAgentAvailable(): boolean {
  const backend = getBackend()
  if (backend === 'diagram-api') {
    return typeof DIAGRAM_API_URL === 'string' && DIAGRAM_API_URL.length > 0
  }
  if (backend === 'node-agent') {
    if (typeof AGENT_URL !== 'string' || !AGENT_URL) return false
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const base = AGENT_URL.replace(/\/$/, '')
      if (base === origin || base === origin.replace(/\/$/, '')) return false
      return true
    } catch {
      return false
    }
  }
  return false
}

// --- State atoms ---

export const $isAgentOpen = atom(false)
export const $messages = atom<ChatMessage[]>([])
export const $sessionId = atom<string | null>(null)
export const $isStreaming = atom(false)
export const $agentContext = atom<AgentViewContext>({})
export const $skills = atom<SkillInfo[]>([])
export const $skillsLoaded = atom(false)

// --- Computed ---

export const $hasMessages = computed($messages, msgs => msgs.length > 0)

// --- Actions ---

let _msgIdCounter = 0
function nextId() {
  return `msg-${++_msgIdCounter}-${Date.now()}`
}

export function openAgent() {
  $isAgentOpen.set(true)
}

export function closeAgent() {
  $isAgentOpen.set(false)
}

export function toggleAgent() {
  $isAgentOpen.set(!$isAgentOpen.get())
}

export function clearChat() {
  $messages.set([])
  $sessionId.set(null)
}

export function setContext(ctx: AgentViewContext) {
  $agentContext.set(ctx)
}

async function loadSkills() {
  if ($skillsLoaded.get() || !isAgentAvailable()) return
  if (getBackend() !== 'node-agent') {
    // Diagram API backend has no skills endpoint; mark as loaded with empty list
    $skills.set([])
    $skillsLoaded.set(true)
    return
  }
  try {
    const resp = await fetch(`${AGENT_URL}/skills`)
    if (resp.ok) {
      const data = (await resp.json()) as { skills: SkillInfo[] }
      $skills.set(data.skills || [])
      $skillsLoaded.set(true)
    }
  } catch {
    // silently ignore — agent might not be running
  }
}

export async function sendMessage(text: string) {
  if ($isStreaming.get()) return
  if (!text.trim()) return
  if (!isAgentAvailable()) {
    const userMsg: ChatMessage = {
      id: nextId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }
    $messages.set([...$messages.get(), userMsg])
    const backend = getBackend()
    const help = backend === 'diagram-api'
      ? 'Set VITE_LIKEC4_DIAGRAM_API_URL to a likec4-diagram-api server (not this app URL).'
      : 'Set VITE_LIKEC4_AGENT_URL to a LikeC4 agent server (not this app URL).'
    const errMsg: ChatMessage = {
      id: nextId(),
      role: 'assistant',
      content: `Agent not configured. ${help}`,
      timestamp: new Date(),
    }
    $messages.set([...$messages.get(), errMsg])
    return
  }

  const userMsg: ChatMessage = {
    id: nextId(),
    role: 'user',
    content: text,
    timestamp: new Date(),
  }
  $messages.set([...$messages.get(), userMsg])
  $isStreaming.set(true)

  const assistantMsgId = nextId()
  const assistantMsg: ChatMessage = {
    id: assistantMsgId,
    role: 'assistant',
    content: '',
    toolCalls: [],
    timestamp: new Date(),
  }
  $messages.set([...$messages.get(), assistantMsg])

  try {
    const backend = getBackend()
    const currentSessionId = $sessionId.get()
    const context = $agentContext.get()

    if (backend === 'diagram-api') {
      if (!DIAGRAM_API_URL) {
        updateLastMessage(assistantMsgId, {
          content: 'Error: VITE_LIKEC4_DIAGRAM_API_URL is not set.',
        })
        return
      }

      const promptParts: string[] = []
      const trimmed = text.trim()
      if (trimmed) {
        promptParts.push(trimmed)
      }
      if (context.projectId || context.viewId || context.selectedElementId) {
        const ctxSummary = [
          context.projectId ? `projectId=${context.projectId}` : null,
          context.viewId ? `viewId=${context.viewId}` : null,
          context.selectedElementId ? `selectedElementId=${context.selectedElementId}` : null,
        ]
          .filter(Boolean)
          .join(', ')
        promptParts.push(`\n\nContext: ${ctxSummary}`)
      }

      const response = await fetch(`${DIAGRAM_API_URL.replace(/\/$/, '')}/api/v1/ai/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(DIAGRAM_API_TOKEN ? { Authorization: `Bearer ${DIAGRAM_API_TOKEN}` } : {}),
        },
        body: JSON.stringify({
          prompt: promptParts.join(''),
          ...(context.currentDsl ? { current_dsl: context.currentDsl } : {}),
          ...(context.viewId ? { view_id: context.viewId } : {}),
        }),
      })

      if (!response.ok) {
        updateLastMessage(assistantMsgId, { content: `Error: ${response.statusText}` })
        return
      }

      type DiagramApiResponse = {
        likec4_dsl: string
        explanation?: string | null
      }

      const data = (await response.json()) as DiagramApiResponse
      const explanation = data.explanation?.trim()
      const dsl = data.likec4_dsl?.trim()

      let content = ''
      if (explanation) {
        content += explanation
      }
      if (dsl) {
        if (content) content += '\n\n'
        content += 'Suggested LikeC4 DSL:\n```likec4\n'
        content += dsl
        content += '\n```'
      }
      if (!content) {
        content = 'No LikeC4 DSL was generated.'
      }

      updateLastMessage(assistantMsgId, {
        content,
        toolCalls: [],
      })
      return
    }

    // Fallback: Node-based LikeC4 Agent (existing behaviour)
    const response = await fetch(`${AGENT_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        sessionId: currentSessionId || undefined,
        context,
      }),
    })

    if (!response.ok || !response.body) {
      updateLastMessage(assistantMsgId, { content: `Error: ${response.statusText}` })
      return
    }

    await streamSSEResponse(response.body, assistantMsgId)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to connect to agent'
    updateLastMessage(assistantMsgId, { content: `Error: ${errorMsg}` })
  } finally {
    $isStreaming.set(false)
  }
}

export async function invokeSkill(skillId: string) {
  if ($isStreaming.get()) return
  if (!isAgentAvailable()) return
  if (getBackend() !== 'node-agent') {
    // No skills when using the diagram-api backend
    return
  }
  $isStreaming.set(true)

  const assistantMsgId = nextId()
  const assistantMsg: ChatMessage = {
    id: assistantMsgId,
    role: 'assistant',
    content: '',
    toolCalls: [],
    timestamp: new Date(),
  }
  $messages.set([...$messages.get(), assistantMsg])

  try {
    const currentSessionId = $sessionId.get()
    const context = $agentContext.get()

    const response = await fetch(`${AGENT_URL}/skills/${skillId}/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: currentSessionId || undefined,
        context,
      }),
    })

    if (!response.ok || !response.body) {
      updateLastMessage(assistantMsgId, { content: `Error: ${response.statusText}` })
      return
    }

    await streamSSEResponse(response.body, assistantMsgId)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to invoke skill'
    updateLastMessage(assistantMsgId, { content: `Error: ${errorMsg}` })
  } finally {
    $isStreaming.set(false)
  }
}

function updateLastMessage(id: string, update: Partial<ChatMessage>) {
  $messages.set($messages.get().map(m => (m.id === id ? { ...m, ...update } : m)))
}

async function streamSSEResponse(body: ReadableStream<Uint8Array>, assistantMsgId: string) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const jsonStr = line.slice(6).trim()
        if (!jsonStr) continue

        try {
          const event = JSON.parse(jsonStr) as {
            type: string
            delta?: string
            sessionId?: string
            toolName?: string
            toolInput?: unknown
            result?: unknown
            message?: string
          }

          switch (event.type) {
            case 'text_delta': {
              const msgs = $messages.get()
              const msg = msgs.find(m => m.id === assistantMsgId)
              if (msg) {
                updateLastMessage(assistantMsgId, {
                  content: msg.content + (event.delta || ''),
                })
              }
              break
            }
            case 'tool_call': {
              const msgs = $messages.get()
              const msg = msgs.find(m => m.id === assistantMsgId)
              if (msg) {
                updateLastMessage(assistantMsgId, {
                  toolCalls: [...(msg.toolCalls || []), event.toolName || ''],
                })
              }
              break
            }
            case 'client_tool_call':
              // Playground has no likec4rpc; diagram edits from agent are not applied
              break
            case 'done': {
              if (event.sessionId) {
                $sessionId.set(event.sessionId)
              }
              updateLastMessage(assistantMsgId, { toolCalls: [] })
              break
            }
            case 'error': {
              updateLastMessage(assistantMsgId, {
                content: `Error: ${event.message || 'Unknown error'}`,
                toolCalls: [],
              })
              break
            }
          }
        } catch {
          // ignore malformed SSE events
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

if (isAgentAvailable()) {
  loadSkills()
}
