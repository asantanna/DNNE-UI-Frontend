import darkTemplate from '@/assets/palettes/dark.json'
import { substitutePaletteColors } from '@/constants/dnneColors'
import type {
  ColorPalettes,
  CompletedPalette
} from '@/schemas/colorPaletteSchema'

// Apply color substitutions to the dark palette template
const dark = substitutePaletteColors(darkTemplate) as CompletedPalette

export const CORE_COLOR_PALETTES: ColorPalettes = {
  dark
} as const

export const DEFAULT_COLOR_PALETTE: CompletedPalette = dark
export const DEFAULT_DARK_COLOR_PALETTE: CompletedPalette = dark
export const DEFAULT_LIGHT_COLOR_PALETTE: CompletedPalette = dark
