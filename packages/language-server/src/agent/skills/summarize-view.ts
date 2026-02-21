import type { Skill, ViewContext } from '../types'

export const summarizeViewSkill: Skill = {
  id: 'summarize-view',
  title: 'Summarize architecture',
  description: 'Get an AI summary of the current view and its components',
  icon: 'IconLayoutDashboard',
  requiresContext: ['viewId'],
  buildPrompt(context: ViewContext): string {
    const viewId = context.viewId!
    const projectPart = context.projectId ? ` in project "${context.projectId}"` : ''
    return `Please provide a comprehensive summary of the architecture shown in view "${viewId}"${projectPart}:
1. Use get_view to retrieve the view details and its nodes/edges
2. Use get_project_summary to understand the overall project context
3. Describe the main components and their roles
4. Explain the key interactions and data flows
5. Highlight any notable architectural patterns or concerns

Give a clear, concise overview suitable for a technical audience.`
  },
}
