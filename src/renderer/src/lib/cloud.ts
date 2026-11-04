// Cloud models run on someone else's servers instead of this computer.
// Ollama Cloud names end in ":cloud" or "-cloud". OpenRouter models are stored as "or:vendor/model".
export function isOpenRouter(name: string): boolean {
  return name.startsWith('or:')
}

// Models that use the user's own API key for another company, stored as "api:<provider>:<model>".
export function isApiModel(name: string): boolean {
  return name.startsWith('api:')
}

/** True for models that are not run by Ollama on this computer or Ollama Cloud (they need no running Ollama). */
export function isRemoteModel(name: string): boolean {
  return isOpenRouter(name) || isApiModel(name)
}

export function isCloudModel(name: string): boolean {
  return isRemoteModel(name) || /[:-]cloud$/i.test(name)
}

export const CLOUD_CONSENT_KEY = 'setu.cloudOk'

export function hasCloudConsent(): boolean {
  try {
    return localStorage.getItem(CLOUD_CONSENT_KEY) === '1'
  } catch {
    return false
  }
}

export function saveCloudConsent(): void {
  try {
    localStorage.setItem(CLOUD_CONSENT_KEY, '1')
  } catch {
    /* storage may be unavailable; the question will simply be asked again */
  }
}

// Models the user added from OpenRouter, kept on this computer so they show up in the model picker.
export type SavedOrModel = { id: string; name: string; free: boolean; vision: boolean }
const OR_KEY = 'setu.orModels'

export function loadOrModels(): SavedOrModel[] {
  try {
    const v = JSON.parse(localStorage.getItem(OR_KEY) ?? '[]')
    return Array.isArray(v)
      ? v.filter((m) => m && typeof m.id === 'string').map((m) => ({ id: m.id, name: String(m.name ?? m.id), free: !!m.free, vision: !!m.vision }))
      : []
  } catch {
    return []
  }
}

export function saveOrModels(list: SavedOrModel[]): void {
  try {
    localStorage.setItem(OR_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

export type SavedApiModel = { provider: string; label: string; model: string; vision: boolean }
const API_KEY = 'setu.apiModels'

export function loadApiModels(): SavedApiModel[] {
  try {
    const v = JSON.parse(localStorage.getItem(API_KEY) ?? '[]')
    return Array.isArray(v)
      ? v
          .filter((m) => m && typeof m.provider === 'string' && typeof m.model === 'string')
          .map((m) => ({ provider: m.provider, label: String(m.label ?? m.provider), model: m.model, vision: !!m.vision }))
      : []
  } catch {
    return []
  }
}

export function saveApiModels(list: SavedApiModel[]): void {
  try {
    localStorage.setItem(API_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

export const apiModelName = (m: { provider: string; model: string }): string => `api:${m.provider}:${m.model}`

// Best guess from the name; the user can correct it when adding.
export const looksLikeVision = (model: string): boolean => /gpt-4o|gpt-4\.1|gpt-5|claude|gemini|vision|-vl|llava|pixtral/i.test(model)
