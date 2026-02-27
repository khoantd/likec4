/// <reference types="vite/client" />

// AI Agent backend selection
// - If VITE_LIKEC4_DIAGRAM_API_URL is set, the playground Agent talks directly to likec4-diagram-api.
// - Otherwise, if VITE_LIKEC4_AGENT_URL is set, it talks to the Node-based LikeC4 Agent.
// - If neither is set, the Agent UI is disabled.
declare const AI_BACKEND: 'diagram-api' | 'node-agent' | 'none'
declare const DIAGRAM_API_URL: string
declare const DIAGRAM_API_TOKEN: string
declare const AGENT_ENABLED: boolean
declare const AGENT_URL: string
