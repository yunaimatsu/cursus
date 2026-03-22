import type { Model } from './types.ts';

export const OPENAI_COMPATIBLE_MODELS: Record<string, Model> = {
  'groq-llama-4': {
    id: 'groq-llama-4',
    provider: 'groq',
    apiModel: 'meta-llama/llama-4-scout-17b-16e-instruct',
    contextWindow: 128_000,
    defaultMaxTokens: 4_096,
    canReason: false,
    supportsAttachments: false,
  },
  'openrouter-auto': {
    id: 'openrouter-auto',
    provider: 'openrouter',
    apiModel: 'openrouter/auto',
    contextWindow: 200_000,
    defaultMaxTokens: 4_096,
    canReason: false,
    supportsAttachments: true,
  },
  'xai-grok-code': {
    id: 'xai-grok-code',
    provider: 'xai',
    apiModel: 'grok-code-fast-1',
    contextWindow: 128_000,
    defaultMaxTokens: 4_096,
    canReason: true,
    supportsAttachments: false,
  },
  'local-openai': {
    id: 'local-openai',
    provider: 'local',
    apiModel: 'local-model',
    contextWindow: 32_000,
    defaultMaxTokens: 2_048,
    canReason: false,
    supportsAttachments: false,
  },
};
