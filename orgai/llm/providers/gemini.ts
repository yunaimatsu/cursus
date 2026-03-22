import type { ProviderOptions } from '../provider-options.ts';
import type { Message, Provider, ProviderEvent, ProviderResponse, ToolDefinition } from '../types.ts';
import type { Model } from '../models/index.ts';
import { normalizeFinishReason, normalizeUsage } from '../normalization.ts';

function convertMessages(messages: Message[]): Array<Record<string, unknown>> {
  return messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: message.content
      .map((part) => {
        if (part.type === 'text') return { text: part.text };
        if (part.type === 'image') return { inlineData: { mimeType: part.mimeType, data: part.data } };
        if (part.type === 'tool_call') return { functionCall: { id: part.id, name: part.name, args: part.arguments } };
        if (part.type === 'tool_result') return { functionResponse: { id: part.toolCallId, response: { output: part.content } } };
        return null;
      })
      .filter(Boolean),
  }));
}

function convertTools(tools: ToolDefinition[]): Array<Record<string, unknown>> {
  if (tools.length === 0) return [];
  return [{ functionDeclarations: tools.map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.inputSchema })) }];
}

export class GeminiProvider implements Provider {
  private readonly options: ProviderOptions;
  private readonly model: Model;

  constructor(options: ProviderOptions, model: Model) {
    this.options = options;
    this.model = model;
  }
  Model(): Model { return this.model; }

  async SendMessages(ctx: AbortSignal | undefined, messages: Message[], tools: ToolDefinition[]): Promise<ProviderResponse> {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model.apiModel}:generateContent?key=${this.options.apiKey ?? ''}`, {
      method: 'POST',
      signal: ctx,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: convertMessages(messages), tools: convertTools(tools) }),
    });
    if (!response.ok) throw new Error(`Gemini request failed: ${response.status}`);
    const json = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
    };
    const first = json.candidates?.[0];
    const content = first?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
    return {
      content,
      toolCalls: [],
      usage: normalizeUsage({
        prompt_tokens: json.usageMetadata?.promptTokenCount,
        completion_tokens: json.usageMetadata?.candidatesTokenCount,
        total_tokens: json.usageMetadata?.totalTokenCount,
      }),
      finishReason: normalizeFinishReason(first?.finishReason),
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
