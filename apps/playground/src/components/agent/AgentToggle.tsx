import { ActionIcon, Indicator, Tooltip } from '@mantine/core'
import { useStore } from '@nanostores/react'
import { IconRobot } from '@tabler/icons-react'
import { $isAgentOpen, $isStreaming, isAgentAvailable, toggleAgent } from '../../stores/agentStore'

export function AgentToggle() {
  const isOpen = useStore($isAgentOpen)
  const isStreaming = useStore($isStreaming)

  const tooltipLabel = isAgentAvailable()
    ? isOpen
      ? 'Close AI Agent'
      : 'Open AI Agent'
    : 'AI Agent (set VITE_LIKEC4_DIAGRAM_API_URL or VITE_LIKEC4_AGENT_URL to enable)'

  return (
    <Tooltip label={tooltipLabel} position="bottom" withArrow>
      <Indicator
        disabled={!isAgentAvailable() || !isStreaming}
        processing
        size={8}
        color="blue"
        offset={4}>
        <ActionIcon
          size="md"
          variant={isOpen ? 'filled' : 'subtle'}
          color={isAgentAvailable() && isOpen ? 'blue' : 'gray'}
          onClick={toggleAgent}
          aria-label="Toggle AI Agent panel">
          <IconRobot size={16} />
        </ActionIcon>
      </Indicator>
    </Tooltip>
  )
}
