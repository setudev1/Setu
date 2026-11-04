// The models Setu lists so people do not have to type names. Names must exist in Ollama's library.
// Sizes are the approximate download size from ollama.com (a few are from memory and marked "~").
export type CatalogModel = { name: string; title: string; size: string; note: string }
export type CatalogGroup = { id: string; title: string; blurb: string; models: CatalogModel[] }

export const GROUPS: CatalogGroup[] = [
  {
    id: 'coding',
    title: 'Coding',
    blurb: 'Made to write and fix code. The best starting point for Setu.',
    models: [
      { name: 'qwen2.5-coder:1.5b', title: 'Qwen2.5 Coder 1.5B', size: '~1 GB', note: 'Small and fast. Good first test on any computer.' },
      { name: 'qwen2.5-coder:3b', title: 'Qwen2.5 Coder 3B', size: '~1.9 GB', note: 'A step up from 1.5B and still light. Good for 8 GB computers.' },
      { name: 'qwen2.5-coder:7b', title: 'Qwen2.5 Coder 7B', size: '~4.7 GB', note: 'Better code quality; wants about 8 GB+ of memory.' },
      { name: 'deepseek-coder-v2:16b', title: 'DeepSeek Coder V2 16B', size: '~8.9 GB', note: 'Strong at many programming languages. Wants 16 GB+.' },
      { name: 'qwen2.5-coder:14b', title: 'Qwen2.5 Coder 14B', size: '~9 GB', note: 'Noticeably smarter code. Wants 16 GB+ of memory.' },
      { name: 'qwen3-coder:30b', title: 'Qwen3 Coder 30B', size: '~19 GB', note: 'Very strong coder that works on bigger tasks. Needs a strong computer (32 GB).' },
      { name: 'glm-4.7-flash', title: 'GLM-4.7-Flash', size: '~19 GB', note: 'Best local GLM for coding. Needs a strong computer.' }
    ]
  },
  {
    id: 'thinking',
    title: 'Deep thinking',
    blurb: 'Reason step by step before answering. Slower, but better for hard bugs and logic. Their thinking is hidden in the chat.',
    models: [
      { name: 'qwen3:4b', title: 'Qwen3 4B (thinks)', size: '~2.5 GB', note: 'Small thinking model. Works on 8 GB computers.' },
      { name: 'deepseek-r1:7b', title: 'DeepSeek R1 7B', size: '~4.7 GB', note: 'Well known reasoning model. Wants about 8 GB+.' },
      { name: 'qwen3:8b', title: 'Qwen3 8B (thinks)', size: '~5.2 GB', note: 'Good all-round thinker, also writes code.' },
      { name: 'deepseek-r1:14b', title: 'DeepSeek R1 14B', size: '~9 GB', note: 'Stronger reasoning. Wants 16 GB+.' },
      { name: 'qwen3:14b', title: 'Qwen3 14B (thinks)', size: '~9.3 GB', note: 'Strong thinker for hard problems. Wants 16 GB+.' }
    ]
  },
  {
    id: 'vision',
    title: 'Vision (reads pictures)',
    blurb: 'Can look at screenshots and drawings, so Screenshot to fix and sketches work.',
    models: [
      { name: 'moondream:1.8b', title: 'Moondream 1.8B', size: '~1.7 GB', note: 'Tiny picture reader. Basic, but runs anywhere.' },
      { name: 'qwen2.5vl:3b', title: 'Qwen2.5 VL 3B', size: '~3.2 GB', note: 'Good at reading screens and text in pictures.' },
      { name: 'gemma3:4b', title: 'Gemma 3 4B', size: '~3.3 GB', note: 'Reads pictures and chats well. A good first vision model.' },
      { name: 'qwen2.5vl:7b', title: 'Qwen2.5 VL 7B', size: '~6 GB', note: 'Better at screenshots and layouts. Wants 8 GB+.' },
      { name: 'llama3.2-vision:11b', title: 'Llama 3.2 Vision 11B', size: '~7.8 GB', note: 'Strong picture understanding. Wants 16 GB+.' },
      { name: 'gemma3:12b', title: 'Gemma 3 12B', size: '~8.1 GB', note: 'Sharper vision and chat. Wants 16 GB+.' }
    ]
  },
  {
    id: 'everyday',
    title: 'Everyday chat',
    blurb: 'General models for questions, writing and explaining code.',
    models: [
      { name: 'llama3.2:3b', title: 'Llama 3.2 3B', size: '~2 GB', note: 'Small general model.' },
      { name: 'phi4-mini', title: 'Phi-4 Mini', size: '~2.5 GB', note: 'Small but good at reasoning and maths.' },
      { name: 'llama3.1:8b', title: 'Llama 3.1 8B', size: '~4.9 GB', note: 'Popular all-round model. Wants about 8 GB+.' },
      { name: 'glm4', title: 'GLM-4 9B', size: '~5.5 GB', note: 'Older GLM model for modest computers.' }
    ]
  },
  {
    id: 'tiny',
    title: 'Tiny (for weak computers)',
    blurb: 'Under 1.5 GB. Fast on old laptops, but they make more mistakes.',
    models: [
      { name: 'gemma3:1b', title: 'Gemma 3 1B', size: '~0.8 GB', note: 'Very small chat model.' },
      { name: 'qwen3:1.7b', title: 'Qwen3 1.7B (thinks)', size: '~1.4 GB', note: 'Smallest thinking model that is still useful.' }
    ]
  }
]

// Heavy models that run on Ollama's servers. Names come from Ollama's cloud list and can change;
// if one is gone the row shows Ollama's own error, and "Add by name" accepts any other cloud model.
export const CLOUD_CATALOG: CatalogModel[] = [
  { name: 'glm-5.3-flash:cloud', title: 'GLM-5.3 Flash', size: 'cloud', note: 'Strong at coding and multi-step tasks, much bigger than your PC could run.' },
  { name: 'deepseek-v4-pro:cloud', title: 'DeepSeek V4 Pro', size: 'cloud', note: 'Very large reasoning model with a long memory. Best for hard problems.' }
]

export const ALL_LOCAL: CatalogModel[] = GROUPS.flatMap((g) => g.models)
export const isCataloged = (name: string): boolean => ALL_LOCAL.some((m) => m.name === name) || CLOUD_CATALOG.some((m) => m.name === name)
