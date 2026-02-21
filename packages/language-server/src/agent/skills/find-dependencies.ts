import type { Skill, ViewContext } from '../types'

export const findDependenciesSkill: Skill = {
  id: 'find-dependencies',
  title: 'Find dependencies',
  description: 'Discover all upstream and downstream dependencies of the selected element',
  icon: 'IconGitBranch',
  requiresContext: ['selectedElementId'],
  buildPrompt(context: ViewContext): string {
    const elementId = context.selectedElementId!
    const projectPart = context.projectId ? ` in project "${context.projectId}"` : ''
    return `Find and analyze all dependencies of the element "${elementId}"${projectPart}:
1. Use search_elements or read_element to get details about "${elementId}"
2. Find all direct and transitive upstream dependencies (what "${elementId}" depends on)
3. Find all direct and transitive downstream consumers (what depends on "${elementId}")
4. Summarize the dependency graph and any potential risks or bottlenecks

Present the results clearly with dependency chains.`
  },
}
