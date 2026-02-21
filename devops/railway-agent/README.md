# LikeC4 AI Agent — Railway deployment

Minimal LikeC4 workspace used when deploying the AI Agent to Railway. The agent needs a workspace path for the language server; this folder provides a minimal valid project.

## Deploy on Railway

1. **Create a Railway project** and connect this repo. Leave **Root Directory** empty (deploy from repo root).

2. **Build and start** are set in the repo root **`railway.toml`**. No need to set them in the dashboard unless you want to override.

3. **Set environment variables** in Railway (Settings → Variables):

   | Variable               | Required | Example / notes                          |
   |------------------------|----------|-----------------------------------------|
   | `LIKEC4_AGENT_URL`     | Yes      | `https://litellm.khoadue.me` (LiteLLM or OpenAI-compatible proxy) |
   | `LIKEC4_AGENT_KEY`     | No       | API key if your proxy requires it       |
   | `LIKEC4_AGENT_MODEL`   | No       | `gpt-4o` (default)                      |

4. **Deploy**. The agent listens on Railway's `PORT` (set automatically).

5. **Generate a public URL**: Settings → Networking → **Generate Domain**.

6. **Point the playground** (e.g. Vercel) at the agent:
   - `VITE_LIKEC4_AGENT_URL=https://<your-railway-domain>/agent`  
   The `/agent` path is required because the server serves `/agent/chat`, `/agent/skills`, etc.

Do not use this workspace for real diagrams. More context: **AGENTS.md** (section "Deploying the AI Agent on another server").
