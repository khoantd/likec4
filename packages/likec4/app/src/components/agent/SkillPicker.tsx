import { Button, Group, ScrollArea, Tooltip } from '@mantine/core'
import { useStore } from '@nanostores/react'
import {
  IconCode,
  IconGitBranch,
  IconInfoCircle,
  IconLayoutDashboard,
  IconPlugConnected,
} from '@tabler/icons-react'
import type { SkillInfo } from '../../stores/agentStore'
import { $agentContext, $isStreaming, $skills, invokeSkill } from '../../stores/agentStore'

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  IconInfoCircle,
  IconGitBranch,
  IconLayoutDashboard,
  IconCode,
  IconPlugConnected,
}

function SkillIcon({ name }: { name?: string }) {
  if (name && ICON_MAP[name]) {
    const Icon = ICON_MAP[name]!
    return <Icon size={12} />
  }
  return <IconPlugConnected size={12} />
}

export function SkillPicker() {
  const skills = useStore($skills)
  const isStreaming = useStore($isStreaming)
  const context = useStore($agentContext)

  if (skills.length === 0) return null

  return (
    <ScrollArea
      style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
      scrollbars="x">
      <Group gap={6} p="xs" wrap="nowrap">
        {skills.map(skill => {
          const isDisabled = isStreaming || !isSkillAvailable(skill, context)
          return (
            <Tooltip
              key={skill.id}
              label={skill.description || skill.title}
              position="bottom"
              withArrow>
              <Button
                size="compact-xs"
                variant="light"
                leftSection={<SkillIcon {...(skill.icon ? { name: skill.icon } : {})} />}
                onClick={() => !isDisabled && invokeSkill(skill.id)}
                disabled={isDisabled}
                style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                {skill.title}
              </Button>
            </Tooltip>
          )
        })}
      </Group>
    </ScrollArea>
  )
}

function isSkillAvailable(skill: SkillInfo, context: ReturnType<typeof $agentContext.get>): boolean {
  if (!skill.requiresContext || skill.requiresContext.length === 0) return true
  return skill.requiresContext.every(key => Boolean(context[key]))
}
