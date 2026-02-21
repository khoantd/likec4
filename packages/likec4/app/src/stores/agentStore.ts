import type { LikeC4VitePluginRpc } from 'likec4:rpc'
import { isRpcAvailable, likec4rpc } from 'likec4:rpc'
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
}

export interface SkillInfo {
  id: string
  title: string
  description?: string | undefined
  icon?: string | undefined
  requiresContext?: Array<'projectId' | 'viewId' | 'selectedElementId'> | undefined
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
  if ($skillsLoaded.get()) return
  try {
    const resp = await fetch(`${AGENT_URL}/skills`)
    if (resp.ok) {
      const data = await resp.json() as { skills: SkillInfo[] }
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

  const userMsg: ChatMessage = {
    id: nextId(),
    role: 'user',
    content: text,
    timestamp: new Date(),
  }
  $messages.set([...$messages.get(), userMsg])
  $isStreaming.set(true)

  // Create a pending assistant message that we'll stream into
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
  $messages.set(
    $messages.get().map(m => m.id === id ? { ...m, ...update } : m),
  )
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
            case 'client_tool_call': {
              if (event.toolName === 'update_view' && isRpcAvailable && event.toolInput) {
                const raw = event.toolInput as Record<string, unknown>
                if (raw.projectId && raw.viewId && raw.change) {
                  const payload = raw as Parameters<LikeC4VitePluginRpc['updateView']>[0]
                  likec4rpc.updateView(payload).catch((err: unknown) => {
                    console.warn('Agent update_view failed:', err)
                  })
                }
              }
              break
            }
            case 'done': {
              if (event.sessionId) {
                $sessionId.set(event.sessionId)
              }
              // Clear in-progress tool calls indicator
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

// Load skills when the store is first used
if (AGENT_ENABLED) {
  loadSkills()
}
