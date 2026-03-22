import type { Model } from './types.ts';

export const OPENAI_MODELS: Record<string, Model> = {
  'gpt-5': {
    id: 'gpt-5',
    provider: 'openai',
    apiModel: 'gpt-5',
    contextWindow: 200_000,
    defaultMaxTokens: 8_000,
    canReason: true,
    supportsAttachments: true,
  },
};
