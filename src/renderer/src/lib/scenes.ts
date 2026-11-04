// Built-in wallpapers. They are drawn with CSS, so nothing is downloaded and the installer stays small.
export const SCENES = [
  { id: 'dusk', label: 'Dusk' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'diwali', label: 'Diwali glow' },
  { id: 'nebula', label: 'Nebula' },
  { id: 'mist', label: 'Forest mist' },
  { id: 'rose', label: 'Rose dusk' },
  { id: 'live', label: 'Live code' }
] as const

export type SceneId = (typeof SCENES)[number]['id']
export const isScene = (v: unknown): v is SceneId => SCENES.some((s) => s.id === v)
