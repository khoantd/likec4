# Repository Guidelines

LikeC4 is an architecture-as-code tool for visualizing software architecture. It provides a DSL for describing architecture, a language server, CLI, VSCode extension, and web-based diagram visualization.

## Project Structure & Module Organization

- Monorepo managed by `pnpm` workspaces and `turbo`.
- `apps/` contains user-facing apps (notably `apps/docs` and `apps/playground`).
- `packages/` holds:
  - `likec4/` - CLI, Vite plugin, static site generator (main entry point)
  - `core/` - Core and model types, model builder, compute-view, layout drifts detection logic
  - `language-server/` - Langium-based DSL parser and LSP implementation
  - `language-services/` - Language services initialization (browser and Node.js compatible)
  - `diagram/` - React/ReactFlow diagram renderer
  - `layouts/` - Graphviz-based layout algorithms
  - `generators/` - Export to Mermaid, PlantUML, D2, etc.
  - `vscode/` - VSCode extension
  - `vscode-preview/` - Preview panel component for VSCode
  - `config/` - Configuration schema and validation
  - `icons/` - Icon bundle (never change, unless you are asked to, package is script-generated)
  - `log/` - Shared logging utilities
  - `mcp/` - MCP Server as separate package
  - `tsconfig/` - Shared TypeScript configuration
  - `create-likec4/` - Not used for now
- `e2e/` is an isolated workspace for Playwright end-to-end tests.
- `styled-system/preset` holds PandaCSS preset.
- `styled-system/styles` holds `pandacss codegen` results, shared across packages.
- `examples/` provides sample LikeC4 projects;
- `devops/` - utilities for CI/CD, devops tasks.

## Build, Test, and Development Commands

- `pnpm install` installs dependencies (requires Node `>=22.21.1`).
- `pnpm generate` pre-generates sources; always run after big merges or refactors.
- `pnpm build` builds packages (excludes docs/playground).
- `pnpm typecheck` validates typescript, always run after `pnpm generate`.
- `pnpm test` runs Vitest suites; (you can run `pnpm test --no-typecheck`)

## Generated Files

Several packages have auto-generated files that MUST be generated before:

- `packages/language-server/src/generated/*` - Langium parser (from grammar)
- `packages/language-server/src/generated-lib/*` - Registry of bundled icons
- `packages/vscode/src/meta.ts` - VSCode extension metadata
- `**/routeTree.gen.ts` - TanStack Router routes
- `styled-system/preset/src/generated.ts` - Panda CSS preset
- `styled-system/styles/dist/` - Panda CSS generated styles

DO NOT edit files that are git-ignored - they are generated and your changes will be overwritten.

Always run `pnpm generate` after:

- checkout
- when these files are missing.
- when changing styles presets in `styled-system/preset`
- when changing language grammar in `packages/language-server/src/like-c4.langium`

## Coding Style & Naming Conventions

- TypeScript-first repo; use explicit types.
- Avoid using `any`.
- Formatting is handled by `dprint` (120-column lines, single quotes, no semicolons).
- Use `oxlint` for linting; keep imports sorted and type-only imports grouped first.
- Use JSDoc to document public classes and methods.
- Favor switch(true) over if-else chains.
- Use Context7 MCP tools.

## Testing Guidelines

- Unit/integration tests use `vitest`;
- Test files are named `*.spec.ts` and live alongside sources; may use `__tests__` folders.
- Snapshots are stored in `__snapshots__` folders; update deliberately when behavior changes.
- Aim to cover new features with relevant tests; keep test names descriptive.
- Always run tests before committing.

## Commit & Pull Request Guidelines

- Recent history shows Conventional Commit-style prefixes (e.g., `feat:`, `chore:`); follow this pattern when possible.
- Keep commits focused and scoped to one change.
- Include a changeset for user-facing package changes (`pnpm changeset` or `pnpm changeset:empty`).
- PRs should include a clear description, linked issue (if any), and test results; add screenshots for UI changes.

## Deployment (Vercel)

The **docs** app (`apps/docs`) can be deployed to Vercel. Use the repository root as the project root; `vercel.json` is already configured:

- **Build**: runs `pnpm generate` then builds the docs app and its workspace dependencies.
- **Output**: `apps/docs/dist` (static Astro site).
- No agent or LikeC4 backend env vars are required for the docs build.

The **playground** app (`apps/playground`) can also be deployed to Vercel as a static SPA:

- Create a separate Vercel project and set **Root Directory** to `apps/playground`.
- Vercel sets `VERCEL=1` automatically; the build skips the Cloudflare worker and outputs to `dist`.
- Use `apps/playground/vercel.json` (output directory `dist`, SPA rewrites).
- Backend features (share, auth, viewkv) will not work on Vercel; use Cloudflare for full functionality.
- To enable the AI Agent on the deployed playground, you have two options:
  - **Recommended (Python API)**: Point the playground directly at a running `likec4-diagram-api` service by setting:
    - `VITE_LIKEC4_DIAGRAM_API_URL=https://your-diagram-api-host`
    - (Optional) `VITE_LIKEC4_DIAGRAM_API_TOKEN=<bearer-or-api-token>`
    The playground will call `POST <VITE_LIKEC4_DIAGRAM_API_URL>/api/v1/ai/generate` from the browser.
  - **Existing Node-based Agent**: Deploy the agent on a separate server (see below) and set **VITE_LIKEC4_AGENT_URL** in Vercel to that agent’s base URL (must end with `/agent`).

### Deploying the AI Agent on another server

The playground calls the LikeC4 agent at `/chat` and `/skills`. The agent is not a serverless function; it runs as a long-lived Node server and is today only started together with `likec4 serve`. To use the agent with a Vercel-deployed (or other static) playground:

1. **Host**  
   Use a VPS or PaaS that runs Node and keeps a process open: e.g. **Railway**, **Render**, **Fly.io**, or a small VM (DigitalOcean, etc.).

2. **Workspace**  
   The agent needs a LikeC4 workspace (it uses the language server). Use any LikeC4 project, or a minimal one (e.g. a single `.likec4` file in a folder).

3. **Build and run**  
   From the monorepo root (or after installing the published `likec4` CLI):

   - Set env for the **LiteLLM** (or OpenAI-compatible) backend:
     - `LIKEC4_AGENT_URL` — e.g. `https://litellm.khoadue.me`
     - `LIKEC4_AGENT_KEY` — API key if required
     - `LIKEC4_AGENT_MODEL` — e.g. `gpt-4o`
   - Optional: `LIKEC4_AGENT_PORT=33336` (default).
   - Run: `likec4 serve <path-to-workspace> --port 5173`  
     The agent will listen on `LIKEC4_AGENT_PORT` (33336). You only need to expose that port to the internet (you can leave 5173 internal or unused).

4. **Expose the agent**  
   Point your reverse proxy or PaaS to the agent port (33336). The server serves routes under **`/agent`** (e.g. `/agent/chat`, `/agent/skills`). So the public base URL must include `/agent`.

5. **Playground env**  
   In the playground (e.g. Vercel), set one of:
   - `VITE_LIKEC4_DIAGRAM_API_URL=https://<your-diagram-api-host>` (recommended for the Python `likec4-diagram-api` backend; optional `VITE_LIKEC4_DIAGRAM_API_TOKEN` for auth), **or**
   - `VITE_LIKEC4_AGENT_URL=https://<your-agent-host>/agent`  
     Use the full base URL including `/agent` so the app calls `.../agent/chat` and `.../agent/skills`.

**Example (Railway)**  
- The repo includes **`railway.toml`** at the repo root and a minimal workspace at **`devops/railway-agent`**.
- In Railway: new project → deploy from this repo (leave **Root Directory** empty). Build and start are in `railway.toml`; the agent listens on Railway's `PORT`.
- Set **Variables**: `LIKEC4_AGENT_URL` (e.g. `https://litellm.khoadue.me`), `LIKEC4_AGENT_KEY` (if needed), `LIKEC4_AGENT_MODEL` (e.g. `gpt-4o`).
- After deploy: Settings → Networking → **Generate Domain** (e.g. `https://likec4-agent-production.up.railway.app`).
- In the playground (e.g. Vercel): `VITE_LIKEC4_AGENT_URL=https://<your-railway-domain>/agent`.

## Configuration & Tooling Notes

- Pre-commit hooks use `nano-staged` to run `dprint` on staged files.
- Use `.tool-versions` for the expected Node/pnpm versions.
- The `.cursor/` directory is gitignored; contributors may add their own `.cursor/rules/` locally (e.g. for remotes); do not commit it.
