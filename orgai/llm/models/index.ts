import { ANTHROPIC_MODELS } from './anthropic.ts';
import { CLOUD_MODELS } from './cloud.ts';
import { GEMINI_MODELS } from './gemini.ts';
import { OPENAI_COMPATIBLE_MODELS } from './openai-compatible.ts';
import { OPENAI_MODELS } from './openai.ts';

export type { Model, ProviderName } from './types.ts';

export const SUPPORTED_MODELS = {
  ...OPENAI_MODELS,
  ...ANTHROPIC_MODELS,
  ...GEMINI_MODELS,
  ...OPENAI_COMPATIBLE_MODELS,
  ...CLOUD_MODELS,
};
