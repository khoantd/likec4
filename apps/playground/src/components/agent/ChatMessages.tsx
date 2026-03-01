import { ActionIcon, Avatar, Box, Group, Loader, Paper, ScrollArea, Stack, Text, Tooltip } from '@mantine/core'
import { IconCheck, IconCopy, IconPencilCode, IconRobot, IconUser } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../../stores/agentStore'

interface ChatMessagesProps {
  messages: ChatMessage[]
  isStreaming: boolean
  onApply?: ((content: string) => void) | undefined
}

export function ChatMessages({ messages, isStreaming, onApply }: ChatMessagesProps) {
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
        {messages.map(msg => <MessageBubble key={msg.id} message={msg} onApply={onApply} />)}
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

function MessageBubble({
  message,
  onApply,
}: {
  message: ChatMessage
  onApply?: ((content: string) => void) | undefined
}) {
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
            <MessageText content={message.content} isUser={isUser} onApply={isUser ? undefined : onApply} />
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

function CodeBlock({
  lang,
  code,
  onApply,
}: {
  lang: string
  code: string
  onApply?: ((content: string) => void) | undefined
}) {
  const [copied, setCopied] = useState(false)
  const [applied, setApplied] = useState(false)
  const isLikeC4 = lang === 'likec4' || lang === 'c4'

  const handleCopy = () => {
    void navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleApply = () => {
    onApply?.(code)
    setApplied(true)
    setTimeout(() => setApplied(false), 1500)
  }

  return (
    <Box style={{ position: 'relative', margin: '4px 0' }}>
      <Text
        component="code"
        size="xs"
        style={{
          display: 'block',
          background: 'var(--mantine-color-dark-7)',
          color: 'var(--mantine-color-green-4)',
          padding: '8px 36px 8px 8px',
          borderRadius: '4px',
          fontFamily: 'monospace',
          whiteSpace: 'pre',
          overflowX: 'auto',
        }}>
        {code}
      </Text>
      <Group
        gap={4}
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
        }}>
        {isLikeC4 && onApply && (
          <Tooltip label={applied ? 'Applied!' : 'Apply to editor'} position="left">
            <ActionIcon
              size="xs"
              variant="subtle"
              color={applied ? 'teal' : 'gray'}
              onClick={handleApply}
              aria-label="Apply to editor">
              {applied ? <IconCheck size={12} /> : <IconPencilCode size={12} />}
            </ActionIcon>
          </Tooltip>
        )}
        <Tooltip label={copied ? 'Copied!' : 'Copy'} position="left">
          <ActionIcon
            size="xs"
            variant="subtle"
            color={copied ? 'teal' : 'gray'}
            onClick={handleCopy}
            aria-label="Copy code">
            {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
          </ActionIcon>
        </Tooltip>
      </Group>
    </Box>
  )
}

function MessageText({
  content,
  isUser,
  onApply,
}: {
  content: string
  isUser: boolean
  onApply?: ((content: string) => void) | undefined
}) {
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
          const lang = firstNewline >= 0 ? inner.slice(0, firstNewline).trim() : ''
          const code = firstNewline >= 0 ? inner.slice(firstNewline + 1) : inner
          return <CodeBlock key={i} lang={lang} code={code} onApply={onApply} />
        }
        return <span key={i}>{part}</span>
      })}
    </Text>
  )
}
