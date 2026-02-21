import type { Skill, ViewContext } from '../types'

export const generateDslSkill: Skill = {
  id: 'generate-dsl',
  title: 'Generate DSL',
  description: 'Get help writing LikeC4 DSL code for new elements or views',
  icon: 'IconCode',
  buildPrompt(context: ViewContext): string {
    const projectPart = context.projectId
      ? ` for project "${context.projectId}"`
      : ''
    const contextPart = context.viewId
      ? ` (currently viewing: ${context.viewId})`
      : ''
    return `I need help writing LikeC4 DSL code${projectPart}${contextPart}.

Please:
1. Use get_project_summary to understand the existing model structure, element kinds, and naming conventions
2. Ask me what I want to model (new elements, relationships, views, or deployment nodes)
3. Generate valid LikeC4 DSL code following the existing conventions

What would you like to add to the architecture model?`
  },
}
