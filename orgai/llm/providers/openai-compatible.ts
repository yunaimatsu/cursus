import type { Model } from '../models/index.ts';
import { normalizeFinishReason, normalizeUsage } from '../normalization.ts';
import type { ProviderOptions } from '../provider-options.ts';
import type { Message, Provider, ProviderEvent, ProviderResponse, ToolCall, ToolDefinition } from '../types.ts';

type OpenAIMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
};

function convertMessages(messages: Message[]): OpenAIMessage[] {
  return messages.map((message) => {
    if (message.role === 'tool') {
      const toolResult = message.content.find((part) => part.type === 'tool_result');
      return {
        role: 'tool',
        content: toolResult?.type === 'tool_result' ? toolResult.content : '',
        tool_call_id: toolResult?.type === 'tool_result' ? toolResult.toolCallId : '',
      };
    }

    const toolCalls = message.content
      .filter((part) => part.type === 'tool_call')
      .map((part) => ({
        id: part.id,
        type: 'function' as const,
        function: { name: part.name, arguments: JSON.stringify(part.arguments) },
      }));

    const contentParts = message.content
      .map((part) => {
        if (part.type === 'text') return { type: 'text', text: part.text };
        if (part.type === 'image') return { type: 'image_url', image_url: { url: `data:${part.mimeType};base64,${part.data}` } };
        return null;
      })
      .filter((part): part is { type: string; text?: string; image_url?: { url: string } } => part !== null);

    const payload: OpenAIMessage = {
      role: message.role === 'tool' ? 'tool' : message.role,
      content: contentParts.length > 0 ? contentParts : '',
    };
    if (toolCalls.length > 0) payload.tool_calls = toolCalls;
    return payload;
  });
}

function convertTools(tools: ToolDefinition[]): Array<{ type: 'function'; function: ToolDefinition }> {
  return tools.map((tool) => ({ type: 'function', function: tool }));
}

export class OpenAICompatibleProvider implements Provider {
  private readonly model: Model;
  private readonly options: ProviderOptions;

  constructor(options: ProviderOptions) {
    this.model = options.model;
    this.options = options;
  }

  Model(): Model {
    return this.model;
  }

  async SendMessages(
    ctx: AbortSignal | undefined,
    messages: Message[],
    tools: ToolDefinition[],
  ): Promise<ProviderResponse> {
    const baseURL = this.options.baseURL ?? 'https://api.openai.com/v1';
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      signal: ctx,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.options.apiKey ?? ''}`,
        ...(this.options.headers ?? {}),
      },
      body: JSON.stringify({
        model: this.model.apiModel,
        messages: convertMessages(messages),
        tools: convertTools(tools),
        reasoning_effort: this.options.openai?.reasoningEffort,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI-compatible request failed: ${response.status} ${body}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> }; finish_reason?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const first = json.choices?.[0];
    const toolCalls: ToolCall[] = (first?.message?.tool_calls ?? []).map((call) => ({
      id: call.id,
      name: call.function.name,
      arguments: JSON.parse(call.function.arguments || '{}') as Record<string, unknown>,
    }));

    return {
      content: first?.message?.content ?? '',
      toolCalls,
      usage: normalizeUsage(json.usage ?? {}),
      finishReason: normalizeFinishReason(first?.finish_reason),
    };
  }

  async *StreamResponse(
    ctx: AbortSignal | undefined,
    messages: Message[],
    tools: ToolDefinition[],
  ): AsyncIterable<ProviderEvent> {
    const response = await this.SendMessages(ctx, messages, tools);
    yield { type: 'content_start' };
    if (response.content) yield { type: 'content_delta', delta: response.content };
    yield { type: 'content_stop' };
    for (const call of response.toolCalls) {
      yield { type: 'tool_use_start', toolCall: call };
      yield { type: 'tool_use_stop', toolCall: call };
    }
    yield { type: 'complete', response };
  }
}

export const __internal = { convertMessages, convertTools };
