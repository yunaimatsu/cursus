import type { Model } from './types.ts';

export const GEMINI_MODELS: Record<string, Model> = {
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    provider: 'gemini',
    apiModel: 'gemini-2.5-pro',
    contextWindow: 1_000_000,
    defaultMaxTokens: 8_192,
    canReason: true,
    supportsAttachments: true,
  },
};
