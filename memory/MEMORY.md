# LikeC4 Project Memory

## Project Structure
- Monorepo with `apps/` and `packages/`
- Playground app: `apps/playground/` (React + Vite + XState + Monaco + Mantine)
- Language server package: `packages/language-server/`

## Playground Key Files
- State machine: `apps/playground/src/state/playground-machine.ts` (XState)
- State context provider: `apps/playground/src/state/context.tsx`
- Playground hooks: `apps/playground/src/hooks/usePlayground.ts`
- Monaco sync: `apps/playground/src/monaco/LanguageClientSync.tsx`
- Monaco utils: `apps/playground/src/monaco/utils.ts`
- Agent store (nanostore): `apps/playground/src/stores/agentStore.ts`
- Agent panel: `apps/playground/src/components/agent/AgentPanel.tsx`
- Chat messages: `apps/playground/src/components/agent/ChatMessages.tsx`
- Workspace route: `apps/playground/src/routes/w.$workspaceId/route.tsx`

## Language Server Agent
- Types: `packages/language-server/src/agent/types.ts`
- Handler: `packages/language-server/src/agent/AgentHandler.ts`

## AI Multi-Tab Feature (implemented 2026-03)
Per `apps/playground/docs/AI_MULTITAB_SPEC.md`:
- `AgentViewContext` now has `files?: Record<string,string>` (per-file mapping)
- `AgentContextSync` sends `files` (keyed by filename) alongside `currentDsl`
- `PlaygroundEvents` has `workspace.updateFile { filename, content }` — updates files/originalFiles, emits to sync layer
- `PlaygroundEmitted` has `workspace.updateFile` so `LanguageClientSync` can listen
- `LanguageClientSync` listens for `workspace.updateFile` emission → calls `ensureFileInWorkspace` + `BuildDocuments` + `requestComputedModel`
- `ChatMessages` renders `CodeBlock` component with copy button + "Apply to editor" button (pencil icon) for `likec4`/`c4` fenced blocks
- `AgentPanel` registers `updateFileCallback` in agentStore so node-agent `apply_file_edit` client tool calls can update the editor
- `AgentHandler` includes file contents in system prompt and has `apply_file_edit` client tool
- `ViewContext` in types.ts has `currentDsl?` and `files?`

## Patterns
- XState actor accessed via `usePlayground()` hook inside `PlaygroundActorContextProvider`
- Nanostores (`agentStore`) are module-level singletons; components use `useStore()`
- Monaco models are synced via `ensureFileInWorkspace()` utility
- Path aliases: `$hooks/`, `$stores/`, `$state/`, `$components/`, `$/` etc.
