import { SUPPORTED_MODELS } from './models/index.ts';
import type { ProviderName } from './models/index.ts';
import { applyOptions, type ProviderOption, type ProviderOptions } from './provider-options.ts';
import type { Provider } from './types.ts';
import { AnthropicProvider } from './providers/anthropic.ts';
import { GeminiProvider } from './providers/gemini.ts';
import { OpenAICompatibleProvider } from './providers/openai-compatible.ts';

const OPENAI_COMPATIBLE_BASE_URL: Partial<Record<ProviderName, string>> = {
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  xai: 'https://api.x.ai/v1',
};

export function NewProvider(providerName: ProviderName, ...options: ProviderOption[]): Provider {
  const defaultModel = Object.values(SUPPORTED_MODELS).find((model) => model.provider === providerName);
  if (!defaultModel) throw new Error(`No model registered for provider: ${providerName}`);

  const resolved = applyOptions({ model: defaultModel, providerName }, options) as ProviderOptions;

  if (providerName === 'anthropic') return new AnthropicProvider(resolved, resolved.model);
  if (providerName === 'gemini') return new GeminiProvider(resolved, resolved.model);

  const baseURL =
    resolved.baseURL ??
    OPENAI_COMPATIBLE_BASE_URL[providerName] ??
    (providerName === 'local' ? process.env.LOCAL_ENDPOINT || 'http://localhost:11434/v1' : undefined);

  if (providerName === 'openrouter') {
    resolved.headers = {
      ...(resolved.headers ?? {}),
      'HTTP-Referer': 'https://github.com/glassblock/glassblock-cli',
      'X-Title': 'glassblock-cli',
    };
  }

  return new OpenAICompatibleProvider({ ...resolved, baseURL });
}
