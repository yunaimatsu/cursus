import type { Model } from './types.ts';

export const ANTHROPIC_MODELS: Record<string, Model> = {
  'claude-sonnet-4': {
    id: 'claude-sonnet-4',
    provider: 'anthropic',
    apiModel: 'claude-sonnet-4-20250514',
    contextWindow: 200_000,
    defaultMaxTokens: 8_000,
    canReason: true,
    supportsAttachments: true,
  },
};
