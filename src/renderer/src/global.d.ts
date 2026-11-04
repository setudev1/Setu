/// <reference types="vite/client" />
import type {
  CheckpointInfo,
  ChatEvent,
  ChatMsg,
  FileRead,
  OllamaModel,
  PullEvent,
  SpacesState,
  WallpaperState
} from './types'

declare global {
  interface Window {
    setu: {
      platform: string
      ollama: {
        status: () => Promise<{ running: boolean; version?: string }>
        list: () => Promise<OllamaModel[]>
        vision: (model: string) => Promise<boolean>
        chat: (req: {
          id: string
          model: string
          messages: ChatMsg[]
          useProject?: boolean
          style?: { language: string; explain: boolean; name?: string; callMe?: string; learned?: string[] }
          focus?: string[]
        }) => Promise<boolean>
        stopChat: (id: string) => Promise<boolean>
        warm: (model: string) => Promise<boolean>
        pull: (name: string) => Promise<boolean>
        cancelPull: (name: string) => Promise<boolean>
        onChatEvent: (cb: (event: ChatEvent) => void) => () => void
        onPullEvent: (cb: (event: PullEvent) => void) => () => void
      }
      share: { capture: (rect: { x: number; y: number; width: number; height: number }) => Promise<string | null> }
      git: {
        state: () => Promise<
          { ok: false; reason: 'no-git' | 'not-a-repo' } | { ok: true; changed: number; diff: string; truncated: boolean }
        >
      }
      update: {
        check: () => Promise<{ available: boolean; version?: string; url?: string; download?: string; notes?: string; current?: string; configured: boolean; failed?: boolean }>
        open: (url: string) => Promise<boolean>
      }
      setup: {
        installed: () => Promise<boolean>
        start: () => Promise<boolean>
        install: () => Promise<boolean>
        cancel: () => Promise<boolean>
        onEvent: (
          cb: (e: { type: 'progress'; stage: string; percent?: number; message: string } | { type: 'done' } | { type: 'error'; message: string }) => void
        ) => () => void
      }
      run: {
        state: () => Promise<{ trusted: boolean; suggestions: { label: string; command: string }[]; running: boolean }>
        trust: () => Promise<boolean>
        start: (command: string) => Promise<boolean>
        stop: () => Promise<boolean>
        onEvent: (
          cb: (e: { type: 'out'; text: string } | { type: 'exit'; code: number | null; stopped: boolean; timedOut: boolean }) => void
        ) => () => void
      }
      providers: {
        list: () => Promise<{
          presets: { id: string; label: string; kind: string; baseUrl: string }[]
          providers: { id: string; label: string; kind: string; baseUrl: string; hasKey: boolean }[]
        }>
        save: (req: { presetId?: string; label?: string; baseUrl?: string; key: string }) => Promise<{ ok: boolean; error?: string }>
        remove: (id: string) => Promise<{ ok: boolean }>
      }
      openrouter: {
        status: () => Promise<{ hasKey: boolean }>
        setKey: (key: string) => Promise<{ ok: boolean; error?: string }>
        clearKey: () => Promise<{ ok: boolean }>
        models: () => Promise<
          | { ok: true; models: { id: string; name: string; free: boolean; vision: boolean; context: number }[] }
          | { ok: false; error: string }
        >
      }
      system: {
        info: () => Promise<{ ramGB: number; freeDiskGB: number | null }>
      }
      spaces: {
        state: () => Promise<SpacesState>
        add: () => Promise<SpacesState>
        select: (folder: string) => Promise<SpacesState>
        remove: (folder: string) => Promise<SpacesState>
        reveal: () => Promise<boolean>
      }
      wallpaper: {
        get: () => Promise<WallpaperState>
        choose: () => Promise<WallpaperState>
        clear: () => Promise<WallpaperState>
        setLook: (look: { dim?: number; blur?: number }) => Promise<WallpaperState>
      }
      project: {
        read: (path: string) => Promise<FileRead>
        list: () => Promise<{ files: string[]; truncated: boolean }>
        search: (q: string) => Promise<{ hits: { path: string; line: number; text: string }[]; truncated: boolean }>
        apply: (req: {
          label: string
          changes: { path: string; content: string }[]
        }) => Promise<{ checkpointId: string; written: string[] }>
      }
      report: {
        log: (message: string) => Promise<boolean>
        open: (note: string) => Promise<boolean>
      }
      reviews: {
        list: () => Promise<{ ok: boolean; configured: boolean; fetchedAt: number; reviews: { id: number; name: string; stars: number; text: string; at: number; url: string }[] }>
        write: (stars: number, text: string) => Promise<boolean>
      }
      qa: {
        start: (req: { id: string; model: string; target: string; goal: string }) => Promise<boolean>
        stop: (id: string) => Promise<boolean>
        onEvent: (cb: (payload: unknown) => void) => () => void
      }
      image: {
        status: () => Promise<boolean>
        setKey: (account: string, token: string) => Promise<boolean>
        clear: () => Promise<boolean>
        make: (prompt: string) => Promise<{ path: string | null; dataUrl: string }>
      }
      notes: {
        get: () => Promise<string>
        set: (text: string) => Promise<string>
      }
      checkpoints: {
        list: () => Promise<CheckpointInfo[]>
        restore: (id: string) => Promise<{ restored: string[]; undoCheckpointId: string }>
      }
    }
  }
}

export {}
