import { ActionIcon, Box, Drawer, Group, Text, Tooltip } from '@mantine/core'
import { useStore } from '@nanostores/react'
import { IconRobot, IconTrash, IconX } from '@tabler/icons-react'
import { useEffect } from 'react'
import {
  $agentContext,
  $hasMessages,
  $isAgentOpen,
  $isStreaming,
  $messages,
  clearChat,
  closeAgent,
  isAgentAvailable,
  sendMessage,
  setContext,
} from '../../stores/agentStore'
import { ChatInput } from './ChatInput'
import { ChatMessages } from './ChatMessages'
import { SkillPicker } from './SkillPicker'

interface AgentPanelProps {
  projectId?: string | undefined
  viewId?: string | undefined
  selectedElementId?: string | undefined
}

export function AgentPanel({ projectId, viewId, selectedElementId }: AgentPanelProps) {
  const isOpen = useStore($isAgentOpen)
  const messages = useStore($messages)
  const isStreaming = useStore($isStreaming)
  const hasMessages = useStore($hasMessages)

  useEffect(() => {
    setContext({ projectId, viewId, selectedElementId })
  }, [projectId, viewId, selectedElementId])

  return (
    <Drawer
      opened={isOpen}
      onClose={closeAgent}
      position="right"
      size="md"
      withOverlay={false}
      closeOnClickOutside={false}
      lockScroll={false}
      title={
        <Group gap="xs" align="center">
          <IconRobot size={16} />
          <Text size="sm" fw={600}>
            AI Agent
          </Text>
        </Group>
      }
      styles={{
        header: {
          paddingBottom: 0,
          borderBottom: '1px solid var(--mantine-color-default-border)',
        },
        body: {
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 60px)',
        },
        close: { display: 'none' },
      }}>
      <Box
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          display: 'flex',
          gap: 4,
        }}>
        {hasMessages && (
          <Tooltip label="Clear conversation" position="bottom">
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={clearChat}
              disabled={isStreaming}
              aria-label="Clear chat">
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        )}
        <Tooltip label="Close panel" position="bottom">
          <ActionIcon
            size="sm"
            variant="subtle"
            color="gray"
            onClick={closeAgent}
            aria-label="Close agent panel">
            <IconX size={14} />
          </ActionIcon>
        </Tooltip>
      </Box>

      {!isAgentAvailable() ?
        (
          <Box p="md" style={{ flex: 1 }}>
            <Text size="sm" c="dimmed">
              To enable the AI Agent, set <code>VITE_LIKEC4_DIAGRAM_API_URL</code> to a running{' '}
              <code>likec4-diagram-api</code> service (recommended), or set <code>VITE_LIKEC4_AGENT_URL</code>{' '}
              to a LikeC4 agent server (must expose <code>/agent/chat</code>).
            </Text>
          </Box>
        ) :
        (
          <>
            <SkillPicker />
            <ChatMessages messages={messages} isStreaming={isStreaming} />
            <ChatInput onSend={sendMessage} isStreaming={isStreaming} />
          </>
        )}
    </Drawer>
  )
}
