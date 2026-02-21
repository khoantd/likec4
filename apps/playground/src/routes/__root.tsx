import { AgentPanel } from '$components/agent/AgentPanel'
import { useMantineColorScheme } from '@mantine/core'
import { createRootRouteWithContext, Outlet, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'

const asTheme = (v: unknown): 'light' | 'dark' | undefined => {
  if (typeof v !== 'string') {
    return undefined
  }
  const vlower = v.toLowerCase()
  if (vlower === 'light' || vlower === 'dark') {
    return vlower
  }
  return undefined
}

export type SearchParams = {
  theme?: 'light' | 'dark' | undefined
}

export const Route = createRootRouteWithContext<{}>()({
  component: RootComponent,
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    return {
      theme: asTheme(search['theme']),
    }
  },
})

function RootComponent() {
  return (
    <>
      <Outlet />
      <ThemeSync />
      <AgentPanelWithContext />
    </>
  )
}

function extractAgentContext(pathname: string): { projectId?: string; viewId?: string } {
  const match = pathname.match(/\/w\/([^/]+)\/([^/]+)/)
  if (match?.[1] && match[2]) {
    return { projectId: match[1], viewId: match[2] }
  }
  return {}
}

function AgentPanelWithContext() {
  const routerState = useRouterState()
  const { projectId, viewId } = extractAgentContext(routerState.location.pathname)
  return <AgentPanel projectId={projectId} viewId={viewId} />
}

const ThemeSync = () => {
  const { theme } = Route.useSearch()
  const mantineColorScheme = useMantineColorScheme()

  useEffect(() => {
    if (!theme) {
      return
    }
    if (theme !== mantineColorScheme.colorScheme) {
      mantineColorScheme.setColorScheme(theme)
    }
  }, [theme])

  return null
}
