import type { Skill, ViewContext } from '../types'

export const explainElementSkill: Skill = {
  id: 'explain-element',
  title: 'Explain element',
  description: 'Get a detailed explanation of the selected element and its relationships',
  icon: 'IconInfoCircle',
  requiresContext: ['selectedElementId'],
  buildPrompt(context: ViewContext): string {
    const elementId = context.selectedElementId!
    const projectPart = context.projectId ? ` in project "${context.projectId}"` : ''
    return `Please explain the element "${elementId}"${projectPart} in detail. Include:
- What it is and its purpose in the architecture
- Its key relationships (incoming and outgoing)
- Its technology and any important metadata
- How it fits into the overall system

Use the read_element tool to get the full details.`
  },
}
