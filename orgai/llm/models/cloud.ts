import type { Model } from './types.ts';

export const CLOUD_MODELS: Record<string, Model> = {
  'azure-gpt-4.1': {
    id: 'azure-gpt-4.1',
    provider: 'azure',
    apiModel: 'gpt-4.1',
    contextWindow: 128_000,
    defaultMaxTokens: 4_096,
    canReason: true,
    supportsAttachments: true,
  },
  'vertex-gemini-2.5-pro': {
    id: 'vertex-gemini-2.5-pro',
    provider: 'vertexai',
    apiModel: 'gemini-2.5-pro',
    contextWindow: 1_000_000,
    defaultMaxTokens: 8_192,
    canReason: true,
    supportsAttachments: true,
  },
};
