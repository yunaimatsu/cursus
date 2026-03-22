import type { OrgaiConfig } from '../config.ts';
import { SUPPORTED_MODELS } from './models/index.ts';
import { NewProvider } from './provider-factory.ts';
import { WithAPIKey, WithAPIVersion, WithBaseURL, WithEndpoint, WithHeaders, WithModel, WithOpenAIOptions } from './provider-options.ts';
import type { Provider } from './types.ts';

export function createAgentProvider(config: OrgaiConfig, agentName: keyof OrgaiConfig['llm']['agents']): Provider {
  const agentConfig = config.llm.agents[agentName];
  const model = SUPPORTED_MODELS[agentConfig.model];
  if (!model) throw new Error(`Unknown model for agent ${String(agentName)}: ${agentConfig.model}`);

  const providerConfig = config.llm.providers[model.provider];
  if (!providerConfig) throw new Error(`Missing provider config: ${model.provider}`);
  if (providerConfig.disabled) throw new Error(`Provider is disabled: ${model.provider}`);

  return NewProvider(
    model.provider,
    WithModel(model),
    WithAPIKey(providerConfig.apiKey),
    providerConfig.baseURL ? WithBaseURL(providerConfig.baseURL) : (target) => target,
    providerConfig.endpoint ? WithEndpoint(providerConfig.endpoint) : (target) => target,
    providerConfig.apiVersion ? WithAPIVersion(providerConfig.apiVersion) : (target) => target,
    providerConfig.headers ? WithHeaders(providerConfig.headers) : (target) => target,
    model.provider === 'openai' || model.provider === 'local'
      ? WithOpenAIOptions({ reasoningEffort: agentConfig.reasoningEffort })
      : (target) => target,
  );
}
