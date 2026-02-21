import type { Fqn, NonEmptyArray, ProjectId } from '@likec4/core/types'
import { useMantineColorScheme } from '@mantine/core'
import { createRootRouteWithContext, Outlet, stripSearchParams, useRouterState } from '@tanstack/react-router'
import { projects } from 'likec4:projects'
import { useEffect } from 'react'
import { map } from 'remeda'
import z from 'zod/v4'
import { AgentPanel } from '../components/agent/AgentPanel'

const searchParamsSchema = z.object({
  theme: z.literal(['light', 'dark', 'auto'])
    .default('auto')
    .catch('auto'),
  dynamic: z.enum(['diagram', 'sequence'])
    .default('diagram')
    .catch('diagram'),
  padding: z.number()
    .min(0)
    .default(20)
    .catch(20),
  relationships: z.string()
    .nonempty()
    .optional()
    .catch(undefined)
    .transform(v => v as Fqn | undefined),
})

export type SearchParams = z.infer<typeof searchParamsSchema>

export type Context = {
  /**
   * Default (current) project
   */
  projectId: ProjectId

  /**
   * All projects
   */
  projects: readonly [ProjectId, ...ProjectId[]]
}

export const Route = createRootRouteWithContext<Context>()({
  validateSearch: searchParamsSchema,
  search: {
    middlewares: [
      stripSearchParams({
        padding: 20,
        theme: 'auto',
        dynamic: 'diagram',
        relationships: undefined,
      }),
    ],
  },
  beforeLoad: (): Context => {
    const _projects = projects.length > 0
      ? map(projects, p => p.id)
      : ['default' as ProjectId] satisfies NonEmptyArray<ProjectId>
    return {
      projects: _projects,
      projectId: _projects[0],
    }
  },
  component: RootComponent,
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

/** Extracts route params to pass as context into the AgentPanel */
function AgentPanelWithContext() {
  const routerState = useRouterState()
  const { projectId, viewId } = extractRouteContext(routerState.location.pathname)
  return (
    <AgentPanel
      projectId={projectId}
      viewId={viewId}
    />
  )
}

function extractRouteContext(pathname: string): { projectId?: string; viewId?: string } {
  // Match /project/:projectId/view/:viewId/
  const projectViewMatch = pathname.match(/\/project\/([^/]+)\/view\/([^/]+)/)
  if (projectViewMatch?.[1] && projectViewMatch[2]) {
    return { projectId: projectViewMatch[1], viewId: projectViewMatch[2] }
  }
  // Match /view/:viewId/
  const viewMatch = pathname.match(/\/view\/([^/]+)/)
  if (viewMatch?.[1]) {
    return { viewId: viewMatch[1] }
  }
  return {}
}

const ThemeSync = () => {
  const { theme } = Route.useSearch()
  const mantineColorScheme = useMantineColorScheme()

  useEffect(() => {
    if (!theme) {
      return
    }
    mantineColorScheme.setColorScheme(theme)
  }, [theme])

  return null
}
