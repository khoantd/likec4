import { defineTokens } from '@pandacss/dev'
import { tokens as generated } from './generated'

export const colors = defineTokens.colors({
  mantine: generated.colors.mantine,
  // For typesafety, otherwise wrap with []
  transparent: { value: 'transparent' },
  // For fill: none
  none: { value: 'none' },
  inherit: { value: 'inherit' },
})
