import dark from '@/assets/palettes/dark.json'
import type {
  ColorPalettes,
  CompletedPalette
} from '@/schemas/colorPaletteSchema'

export const CORE_COLOR_PALETTES: ColorPalettes = {
  dark
} as const

export const DEFAULT_COLOR_PALETTE: CompletedPalette = dark
export const DEFAULT_DARK_COLOR_PALETTE: CompletedPalette = dark
export const DEFAULT_LIGHT_COLOR_PALETTE: CompletedPalette = dark
