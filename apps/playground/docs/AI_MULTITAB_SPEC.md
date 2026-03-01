# Playground AI: Multi-Tab Context and Apply Edits

**Specification** for enabling the Playground AI to (1) include structured content from all editor tabs in agent context, and (2) apply AI-suggested changes back to specific tabs.

---

## Current state

- **Context sent to AI**: `AgentContextSync` (in `src/routes/w.$workspaceId/route.tsx`) builds a single string `currentDsl = Object.values(files).join('\n\n')` and passes it as `currentDsl` in `AgentViewContext` (`src/stores/agentStore.ts`). All tab contents are sent, but **without filenames** — the AI cannot tell which snippet belongs to which file.
- **Backends**:
  - **Diagram-api**: Receives `prompt`, `current_dsl` (one string), `view_id`; returns `likec4_dsl` (one string). No notion of multiple files or “which file to edit.”
  - **Node-agent**: Receives `context` (projectId, viewId, selectedElementId; `ViewContext` in `packages/language-server/src/agent/types.ts` does not declare `currentDsl`, though the playground sends it). Agent has no tool to edit source files; only `update_view` for diagram view changes (Playground currently ignores `client_tool_call` for that).
- **Applying changes**: There is **no apply-to-editor flow**. Diagram-api response is only shown in the chat as a code block. The state machine has `monaco.onTextChanged` (user typing, updates `context.files[activeFilename]` only) and `workspace.addFile`; there is **no** `workspace.updateFile` or “replace content of file X” event. The AI cannot currently make changes to tabs.

---

## Goals

1. **Include content from any available tabs** in a way the AI can use (e.g. per-file mapping).
2. **Make changes** from the AI to specific tabs (apply suggested DSL or per-file edits to the editor and keep state + Monaco in sync).

---

## 1. Per-file context (include all tabs)

### Playground

- Extend `AgentViewContext` (`src/stores/agentStore.ts`) to carry a **per-file** mapping: `files?: Record<string, string>` (optional so backends that only use `currentDsl` keep working).
- In `AgentContextSync` (`src/routes/w.$workspaceId/route.tsx`), in addition to (or instead of) `currentDsl`, set `files: { ...ctx.files }` from `usePlaygroundContext(ctx => ctx.files)` so the agent receives e.g. `{ "model.c4": "...", "views.c4": "..." }`.
- Keep sending `currentDsl` for backward compatibility with diagram-api. Optionally derive `currentDsl` from `files` when building the request so both representations stay in sync.

### Diagram-api (if in scope)

- Extend the `/api/v1/ai/generate` request body to accept an optional **per-file** payload: `files?: Record<string, string>`. When present, the prompt can include “Current files: …” with filename labels so the model can reference and edit by file. Response can remain a single `likec4_dsl` for a first version, or be extended later to per-file edits.

### Node-agent

- Extend `ViewContext` (`packages/language-server/src/agent/types.ts`) with optional `currentDsl?: string` and `files?: Record<string, string>`.
- In `AgentHandler` (`packages/language-server/src/agent/AgentHandler.ts`), include file contents (with filenames) in the system or user message when `context.files` is present, so the model can reason over all available tabs and, later, over which file to change.

---

## 2. Apply AI changes to tabs

### State machine

- Add a new event: **`workspace.updateFile`** with payload `{ filename: string; content: string }`.
- In the `ready` state, handle it similarly to `workspace.addFile`:
  - Update `context.files[filename]` and `context.originalFiles[filename]`.
  - Optionally set `activeFilename` to `filename` (or leave active tab unchanged).
  - If `filename` is not in `context.files`, treat as add: same as `workspace.addFile` (add new file and switch to it).
- No separate event for “replace entire file”; `workspace.updateFile` covers “set content of this file” (create or replace).

**Files to touch:** `src/state/playground-machine.ts` (event type, handler in `ready`).

### Monaco sync

- In `LanguageClientSync` (`src/monaco/LanguageClientSync.tsx`), when the playground context updates (e.g. after `workspace.updateFile`), the **state** already has the new content in `context.files[filename]`. The sync layer must ensure the **Monaco model** for that URI is updated:
  - Either subscribe to the actor’s context and, when `files[filename]` changes, get or create the model for `filename` and call `model.setValue(content)` (and notify the LSP / rebuild docs if needed), or
  - Have the state machine emit something the sync layer listens to (e.g. re-emit `workspace.updateFile` for the sync layer). Prefer reusing existing reactivity (context from the machine) so a single source of truth drives both state and editor.
- Ensure LSP/build-docs is triggered after programmatic edits (e.g. same path as when the user types: BuildDocuments + requestComputedModel).

### Where to trigger “apply”

**Option A — Apply button in the chat UI**

- When the assistant message contains a suggested DSL block (e.g. fenced with ` ```likec4 `), show an **“Apply to editor”** (or “Apply to file X”) button.
- On click:
  - Parse which file(s) the suggestion targets (from metadata in the message, or default to active file / single “main” file).
  - Call a helper that sends `workspace.updateFile(filename, content)` for each target file. For a single full-DSL response, that is typically one file or a convention like “replace active file” or “model.c4”.

**Option B — Client tool from the node-agent**

- Add a client-only tool, e.g. **`apply_file_edit`** (or `update_source_file`), with params `filename: string`, `content: string`.
- When the agent calls it, the server emits `client_tool_call`; the Playground’s `streamSSEResponse` handler (`src/stores/agentStore.ts`) runs the tool by sending `workspace.updateFile` to the actor.
- This gives the node-agent the ability to make changes to any tab by filename.

**Recommendation**

- Implement **Option A** first: “Apply to editor” in the chat for the diagram-api response (and optionally for node-agent when the message contains a code block). That unblocks “make changes” for the main diagram-api flow.
- Optionally add **Option B** so the node-agent can apply edits via `client_tool_call` and `workspace.updateFile` without the user clicking Apply.

**Note:** Diagram-api is request/response (no streaming tools). “Make changes” for diagram-api is only via the Apply button (Option A). Option B applies to the node-agent only.

---

## 3. File-targeting for “Apply” (single-DSL backends)

When the backend returns a **single** `likec4_dsl` string:

- **Default**: Apply to the **currently active tab** (simple and predictable).
- **Optional later**: Allow the user to choose “Replace active file” vs “New file” (then use `workspace.addFile` with a generated name). Or let the API return a suggested filename (e.g. `target_file?: string`) and use that when calling `workspace.updateFile` / `workspace.addFile`.

---

## 4. Summary of changes

| Area                   | Change                                                                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Playground context     | Add `files?: Record<string, string>` to `AgentViewContext`; set it in `AgentContextSync` from `ctx.files`.                                                      |
| Diagram-api request    | Optionally send `files` (per-file content) in addition to `current_dsl`; document that AI can use it for context.                                               |
| Node-agent ViewContext | Add optional `currentDsl?` and `files?`; use in system/user message so model sees all tabs.                                                                     |
| State machine          | Add `workspace.updateFile: { filename: string; content: string }`; in `ready`, update `files`/`originalFiles` (and optionally `activeFilename`).                |
| Monaco sync            | When `context.files[filename]` changes (e.g. after `workspace.updateFile`), update the Monaco model for that file and re-trigger LSP/build-docs.                |
| Chat UI                | Add “Apply to editor” for assistant messages that contain a LikeC4 code block; on click, send `workspace.updateFile(activeFilename, content)` (or chosen file). |
| Node-agent (optional)  | Add client tool `apply_file_edit` (filename, content); in Playground SSE handler, on `client_tool_call` for that tool, send `workspace.updateFile`.             |

---

## 5. Data flow (high level)

```mermaid
sequenceDiagram
  participant User
  participant AgentContextSync
  participant AgentStore
  participant Backend as "Diagram-API / Node-Agent"
  participant ChatUI
  participant Actor as "Playground Actor"
  participant Monaco

  User->>AgentContextSync: (files from ctx.files)
  AgentContextSync->>AgentStore: setContext({ files, currentDsl, ... })
  User->>AgentStore: sendMessage(text)
  AgentStore->>Backend: POST with context.files (and/or currentDsl)
  Backend->>AgentStore: likec4_dsl or stream + client_tool_call
  AgentStore->>ChatUI: update message (content / tool calls)
  User->>ChatUI: Click "Apply to editor"
  ChatUI->>Actor: workspace.updateFile(filename, content)
  Actor->>Actor: assign files[filename], originalFiles[filename]
  Actor->>Monaco: (context drives sync; model.setValue or equivalent)
  Monaco->>Actor: monaco.onTextChanged (if user edits again)
```

---

## 6. Out of scope / notes

- No edits to grammar or generated files are required.
- Backend contract changes (diagram-api, node-agent) are additive: optional `files`, optional client tool.
- This spec does not define the exact API schema for diagram-api `files` (e.g. key format); that can be aligned with the existing `current_dsl` usage and documented in the diagram-api repo or OpenAPI spec.
