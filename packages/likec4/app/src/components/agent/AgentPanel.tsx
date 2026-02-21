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

  // Sync current view context into the store
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
          <Text size="sm" fw={600}>AI Agent</Text>
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
      {/* Custom header actions */}
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

      {/* When agent not configured, show setup instructions */}
      {!AGENT_ENABLED
        ? (
          <Box p="md" style={{ flex: 1 }}>
            <Text size="sm" c="dimmed">
              To enable the AI Agent, set LIKEC4_AGENT_URL in your .env file and restart the dev server. See
              .env.example for details.
            </Text>
          </Box>
        )
        : (
          <>
            {/* Skill quick-access row */}
            <SkillPicker />

            {/* Chat messages area */}
            <ChatMessages messages={messages} isStreaming={isStreaming} />

            {/* Input area */}
            <ChatInput onSend={sendMessage} isStreaming={isStreaming} />
          </>
        )}
    </Drawer>
  )
}
