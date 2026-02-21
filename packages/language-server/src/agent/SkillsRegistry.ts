import { explainElementSkill } from './skills/explain-element'
import { findDependenciesSkill } from './skills/find-dependencies'
import { generateDslSkill } from './skills/generate-dsl'
import { summarizeViewSkill } from './skills/summarize-view'
import type { AgentTool, Plugin, Skill } from './types'

export class SkillsRegistry {
  private skills = new Map<string, Skill>()
  private plugins: Plugin[] = []

  constructor() {
    // Register built-in skills
    this.registerSkill(explainElementSkill)
    this.registerSkill(findDependenciesSkill)
    this.registerSkill(summarizeViewSkill)
    this.registerSkill(generateDslSkill)
  }

  registerSkill(skill: Skill): void {
    this.skills.set(skill.id, skill)
  }

  registerPlugin(plugin: Plugin): void {
    this.plugins.push(plugin)
  }

  getSkill(id: string): Skill | undefined {
    return this.skills.get(id)
  }

  listSkills(): Skill[] {
    const builtinSkills = [...this.skills.values()]
    const pluginSkills = this.plugins.flatMap(p =>
      // Plugins may contribute additional skills via tool definitions (future)
      [] as Skill[]
    )
    return [...builtinSkills, ...pluginSkills]
  }

  listPlugins(): Plugin[] {
    return [...this.plugins]
  }

  getAllPluginTools(): AgentTool[] {
    return this.plugins.flatMap(p => p.tools)
  }
}
