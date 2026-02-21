import { Avatar, Box, Group, Loader, Paper, ScrollArea, Stack, Text } from '@mantine/core'
import { IconRobot, IconUser } from '@tabler/icons-react'
import { useEffect, useRef } from 'react'
import type { ChatMessage } from '../../stores/agentStore'

interface ChatMessagesProps {
  messages: ChatMessage[]
  isStreaming: boolean
}

export function ChatMessages({ messages, isStreaming }: ChatMessagesProps) {
  const viewportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTo({ top: viewportRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [messages])

  if (messages.length === 0) {
    return (
      <Box
        flex={1}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.5,
        }}>
        <Stack align="center" gap="xs">
          <IconRobot size={40} />
          <Text size="sm" ta="center">
            Ask anything about your architecture,
            <br />
            or pick a skill above to get started.
          </Text>
        </Stack>
      </Box>
    )
  }

  return (
    <ScrollArea flex={1} viewportRef={viewportRef} style={{ minHeight: 0 }}>
      <Stack gap="md" p="sm">
        {messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}
        {isStreaming && messages.at(-1)?.role === 'user' && (
          <Group gap="xs" align="flex-start">
            <Avatar size="sm" color="blue" radius="xl">
              <IconRobot size={14} />
            </Avatar>
            <Paper
              px="sm"
              py="xs"
              radius="md"
              style={{ background: 'var(--mantine-color-blue-light)' }}>
              <Loader size="xs" type="dots" />
            </Paper>
          </Group>
        )}
      </Stack>
    </ScrollArea>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  const hasToolCalls = message.toolCalls && message.toolCalls.length > 0

  return (
    <Group gap="xs" align="flex-start" justify={isUser ? 'flex-end' : 'flex-start'}>
      {!isUser && (
        <Avatar size="sm" color="blue" radius="xl" style={{ flexShrink: 0 }}>
          <IconRobot size={14} />
        </Avatar>
      )}

      <Stack gap={4} style={{ maxWidth: '85%' }}>
        {hasToolCalls && (
          <Stack gap={2}>
            {message.toolCalls!.map((toolName, i) => (
              <Group key={i} gap={4} align="center">
                <Loader size={10} type="dots" />
                <Text size="xs" c="dimmed" fs="italic">
                  Calling: {toolName.replace(/_/g, ' ')}
                </Text>
              </Group>
            ))}
          </Stack>
        )}

        {message.content && (
          <Paper
            px="sm"
            py="xs"
            radius="md"
            style={{
              background: isUser ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-default)',
              border: isUser ? 'none' : '1px solid var(--mantine-color-default-border)',
            }}>
            <MessageText content={message.content} isUser={isUser} />
          </Paper>
        )}
      </Stack>

      {isUser && (
        <Avatar size="sm" color="gray" radius="xl" style={{ flexShrink: 0 }}>
          <IconUser size={14} />
        </Avatar>
      )}
    </Group>
  )
}

function MessageText({ content, isUser }: { content: string; isUser: boolean }) {
  const color = isUser ? 'white' : undefined
  const parts = content.split(/(```[\s\S]*?```)/g)

  return (
    <Text
      size="sm"
      {...(color ? { c: color } : {})}
      style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {parts.map((part, i) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const inner = part.slice(3, -3)
          const firstNewline = inner.indexOf('\n')
          const code = firstNewline >= 0 ? inner.slice(firstNewline + 1) : inner
          return (
            <Text
              key={i}
              component="code"
              size="xs"
              style={{
                display: 'block',
                background: 'var(--mantine-color-dark-7)',
                color: 'var(--mantine-color-green-4)',
                padding: '8px',
                borderRadius: '4px',
                fontFamily: 'monospace',
                margin: '4px 0',
                whiteSpace: 'pre',
                overflowX: 'auto',
              }}>
              {code}
            </Text>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </Text>
  )
}
