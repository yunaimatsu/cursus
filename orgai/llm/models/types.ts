export type ProviderName =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'groq'
  | 'openrouter'
  | 'azure'
  | 'vertexai'
  | 'xai'
  | 'local';

export type Model = {
  id: string;
  provider: ProviderName;
  apiModel: string;
  contextWindow: number;
  defaultMaxTokens: number;
  canReason: boolean;
  supportsAttachments: boolean;
};
