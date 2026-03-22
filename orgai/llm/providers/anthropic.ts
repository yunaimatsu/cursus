import type { ProviderOptions } from '../provider-options.ts';
import type { Message, Provider, ProviderEvent, ProviderResponse, ToolDefinition } from '../types.ts';
import type { Model } from '../models/index.ts';
import { normalizeFinishReason, normalizeUsage } from '../normalization.ts';

function convertMessages(messages: Message[]): Array<Record<string, unknown>> {
  return messages.map((message) => ({
    role: message.role,
    content: message.content
      .map((part) => {
        if (part.type === 'text') return { type: 'text', text: part.text };
        if (part.type === 'image') return { type: 'image', source: { type: 'base64', media_type: part.mimeType, data: part.data } };
        if (part.type === 'tool_result') return { type: 'tool_result', tool_use_id: part.toolCallId, content: part.content };
        if (part.type === 'tool_call') return { type: 'tool_use', id: part.id, name: part.name, input: part.arguments };
        return null;
      })
      .filter(Boolean),
  }));
}

function convertTools(tools: ToolDefinition[]): Array<Record<string, unknown>> {
  return tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.inputSchema }));
}

export class AnthropicProvider implements Provider {
  private readonly options: ProviderOptions;
  private readonly model: Model;

  constructor(options: ProviderOptions, model: Model) {
    this.options = options;
    this.model = model;
  }
  Model(): Model { return this.model; }

  async SendMessages(ctx: AbortSignal | undefined, messages: Message[], tools: ToolDefinition[]): Promise<ProviderResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctx,
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.options.apiKey ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: this.model.apiModel, messages: convertMessages(messages), tools: convertTools(tools), max_tokens: this.model.defaultMaxTokens }),
    });
    if (!response.ok) throw new Error(`Anthropic request failed: ${response.status}`);
    const json = (await response.json()) as { content?: Array<{ type: string; text?: string }>; stop_reason?: string; usage?: { input_tokens?: number; output_tokens?: number } };
    const content = (json.content ?? []).filter((item) => item.type === 'text').map((item) => item.text ?? '').join('');
    return {
      content,
      toolCalls: [],
      usage: normalizeUsage({ prompt_tokens: json.usage?.input_tokens, completion_tokens: json.usage?.output_tokens }),
      finishReason: normalizeFinishReason(json.stop_reason),
    };
  }

  async *StreamResponse(ctx: AbortSignal | undefined, messages: Message[], tools: ToolDefinition[]): AsyncIterable<ProviderEvent> {
    const response = await this.SendMessages(ctx, messages, tools);
    yield { type: 'content_start' };
    if (response.content) yield { type: 'content_delta', delta: response.content };
    yield { type: 'content_stop' };
    yield { type: 'complete', response };
  }
}

export const __internal = { convertMessages, convertTools };
