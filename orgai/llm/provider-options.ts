import type { Model, ProviderName } from './models/index.ts';

export type ProviderConfig = {
  apiKey: string;
  disabled: boolean;
  baseURL?: string;
  endpoint?: string;
  apiVersion?: string;
  headers?: Record<string, string>;
};

export type ProviderOptions = {
  model: Model;
  providerName: ProviderName;
  apiKey?: string;
  baseURL?: string;
  endpoint?: string;
  apiVersion?: string;
  headers?: Record<string, string>;
  openai?: {
    reasoningEffort?: 'low' | 'medium' | 'high';
  };
};

export type ProviderOption = (target: ProviderOptions) => ProviderOptions;

export function WithModel(model: Model): ProviderOption {
  return (target) => ({ ...target, model });
}

export function WithAPIKey(apiKey: string): ProviderOption {
  return (target) => ({ ...target, apiKey });
}

export function WithBaseURL(baseURL: string): ProviderOption {
  return (target) => ({ ...target, baseURL });
}

export function WithEndpoint(endpoint: string): ProviderOption {
  return (target) => ({ ...target, endpoint });
}

export function WithAPIVersion(apiVersion: string): ProviderOption {
  return (target) => ({ ...target, apiVersion });
}

export function WithHeaders(headers: Record<string, string>): ProviderOption {
  return (target) => ({ ...target, headers: { ...(target.headers ?? {}), ...headers } });
}

export function WithOpenAIOptions(openai: { reasoningEffort?: 'low' | 'medium' | 'high' }): ProviderOption {
  return (target) => ({ ...target, openai: { ...(target.openai ?? {}), ...openai } });
}

export function applyOptions(base: ProviderOptions, options: ProviderOption[]): ProviderOptions {
  return options.reduce((acc, option) => option(acc), base);
}
