import { ActionIcon, Indicator, Tooltip } from '@mantine/core'
import { useStore } from '@nanostores/react'
import { IconRobot } from '@tabler/icons-react'
import { $isAgentOpen, $isStreaming, toggleAgent } from '../../stores/agentStore'

export function AgentToggle() {
  const isOpen = useStore($isAgentOpen)
  const isStreaming = useStore($isStreaming)

  const tooltipLabel = AGENT_ENABLED
    ? (isOpen ? 'Close AI Agent' : 'Open AI Agent')
    : 'AI Agent (set LIKEC4_AGENT_URL in .env to enable)'

  return (
    <Tooltip
      label={tooltipLabel}
      position="bottom"
      withArrow>
      <Indicator
        disabled={!AGENT_ENABLED || !isStreaming}
        processing
        size={8}
        color="blue"
        offset={4}>
        <ActionIcon
          size="md"
          variant={isOpen ? 'filled' : 'subtle'}
          color={AGENT_ENABLED && isOpen ? 'blue' : 'gray'}
          onClick={toggleAgent}
          aria-label="Toggle AI Agent panel">
          <IconRobot size={16} />
        </ActionIcon>
      </Indicator>
    </Tooltip>
  )
}
