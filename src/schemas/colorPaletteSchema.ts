import { LiteGraph } from '@comfyorg/litegraph'
import { z } from 'zod'

const nodeSlotSchema = z.object({
  // Core ML/NN types
  TENSOR: z.string(),
  MODEL: z.string(),
  DATASET: z.string(),
  DATALOADER: z.string(),
  OPTIMIZER: z.string(),
  SCHEMA: z.string(),
  IMAGE: z.string(),
  
  // Robotics types
  ROBOT_STATE: z.string(),
  SENSOR_DATA: z.string(),
  ACTION: z.string(),
  CONTEXT: z.string(),
  ENV_HANDLE: z.string(),
  SIM_HANDLE: z.string(),
  
  // Control/sync types
  SYNC: z.string(),
  TRIGGER: z.string(),
  BALANCING_CONFIG: z.string(),
  
  // RL types
  ISAAC_ENV_CONFIG: z.string(),
  PPO_CONFIG: z.string(),
  PPO_AGENT: z.string(),
  RL_METRICS: z.string(),
  
  // Basic types
  DICT: z.string(),
  FLOAT: z.string(),
  INT: z.string(),
  STRING: z.string(),
  BOOLEAN: z.string(),
  COMBO: z.string(),
  
  // Legacy ComfyUI types (kept for compatibility)
  CLIP: z.string().optional(),
  CLIP_VISION: z.string().optional(),
  CLIP_VISION_OUTPUT: z.string().optional(),
  CONDITIONING: z.string().optional(),
  CONTROL_NET: z.string().optional(),
  LATENT: z.string().optional(),
  MASK: z.string().optional(),
  STYLE_MODEL: z.string().optional(),
  VAE: z.string().optional(),
  NOISE: z.string().optional(),
  GUIDER: z.string().optional(),
  SAMPLER: z.string().optional(),
  SIGMAS: z.string().optional(),
  TAESD: z.string().optional()
})

const litegraphBaseSchema = z.object({
  BACKGROUND_IMAGE: z.string(),
  CLEAR_BACKGROUND_COLOR: z.string(),
  NODE_TITLE_COLOR: z.string(),
  NODE_SELECTED_TITLE_COLOR: z.string(),
  NODE_TEXT_SIZE: z.number(),
  NODE_TEXT_COLOR: z.string(),
  NODE_TEXT_HIGHLIGHT_COLOR: z.string(),
  NODE_SUBTEXT_SIZE: z.number(),
  NODE_DEFAULT_COLOR: z.string(),
  NODE_DEFAULT_BGCOLOR: z.string(),
  NODE_DEFAULT_BOXCOLOR: z.string(),
  NODE_DEFAULT_SHAPE: z.union([
    z.literal(LiteGraph.BOX_SHAPE),
    z.literal(LiteGraph.ROUND_SHAPE),
    z.literal(LiteGraph.CARD_SHAPE),
    // Legacy palettes have string field for NODE_DEFAULT_SHAPE.
    z.string()
  ]),
  NODE_BOX_OUTLINE_COLOR: z.string(),
  NODE_BYPASS_BGCOLOR: z.string(),
  NODE_ERROR_COLOUR: z.string(),
  DEFAULT_SHADOW_COLOR: z.string(),
  DEFAULT_GROUP_FONT: z.number(),
  WIDGET_BGCOLOR: z.string(),
  WIDGET_OUTLINE_COLOR: z.string(),
  WIDGET_TEXT_COLOR: z.string(),
  WIDGET_SECONDARY_TEXT_COLOR: z.string(),
  WIDGET_DISABLED_TEXT_COLOR: z.string(),
  LINK_COLOR: z.string(),
  EVENT_LINK_COLOR: z.string(),
  CONNECTING_LINK_COLOR: z.string(),
  BADGE_FG_COLOR: z.string(),
  BADGE_BG_COLOR: z.string()
})

const comfyBaseSchema = z.object({
  ['fg-color']: z.string(),
  ['bg-color']: z.string(),
  ['bg-img']: z.string().optional(),
  ['comfy-menu-bg']: z.string(),
  ['comfy-menu-secondary-bg']: z.string(),
  ['comfy-input-bg']: z.string(),
  ['input-text']: z.string(),
  ['descrip-text']: z.string(),
  ['drag-text']: z.string(),
  ['error-text']: z.string(),
  ['border-color']: z.string(),
  ['tr-even-bg-color']: z.string(),
  ['tr-odd-bg-color']: z.string(),
  ['content-bg']: z.string(),
  ['content-fg']: z.string(),
  ['content-hover-bg']: z.string(),
  ['content-hover-fg']: z.string(),
  ['bar-shadow']: z.string()
})

const colorsSchema = z.object({
  node_slot: nodeSlotSchema,
  litegraph_base: litegraphBaseSchema,
  comfy_base: comfyBaseSchema
})

const partialColorsSchema = z.object({
  node_slot: nodeSlotSchema.partial(),
  litegraph_base: litegraphBaseSchema.partial(),
  comfy_base: comfyBaseSchema.partial()
})

// Palette in the wild can have custom metadata fields such as 'version'.
export const paletteSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    colors: partialColorsSchema,
    light_theme: z.boolean().optional()
  })
  .passthrough()

export const completedPaletteSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    colors: colorsSchema
  })
  .passthrough()

export const colorPalettesSchema = z.record(paletteSchema)

export type Colors = z.infer<typeof colorsSchema>
export type Palette = z.infer<typeof paletteSchema>
export type CompletedPalette = z.infer<typeof completedPaletteSchema>
export type ColorPalettes = z.infer<typeof colorPalettesSchema>
