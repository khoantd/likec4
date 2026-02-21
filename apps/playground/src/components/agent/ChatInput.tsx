import { ActionIcon, Group, Textarea } from '@mantine/core'
import { IconSend } from '@tabler/icons-react'
import { useCallback, useRef, useState } from 'react'

interface ChatInputProps {
  onSend: (text: string) => void
  isStreaming: boolean
}

export function ChatInput({ onSend, isStreaming }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const text = value.trim()
    if (!text || isStreaming) return
    onSend(text)
    setValue('')
    textareaRef.current?.focus()
  }, [value, isStreaming, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  return (
    <Group
      gap="xs"
      align="flex-end"
      p="sm"
      style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
      <Textarea
        ref={textareaRef}
        flex={1}
        placeholder="Ask about your architecture… (Enter to send, Shift+Enter for newline)"
        value={value}
        onChange={e => setValue(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        disabled={isStreaming}
        minRows={1}
        maxRows={6}
        autosize
        size="sm"
        radius="md"
        styles={{
          input: {
            resize: 'none',
          },
        }}
      />
      <ActionIcon
        size="lg"
        variant="filled"
        color="blue"
        radius="md"
        onClick={handleSend}
        disabled={!value.trim() || isStreaming}
        aria-label="Send message">
        <IconSend size={16} />
      </ActionIcon>
    </Group>
  )
}
