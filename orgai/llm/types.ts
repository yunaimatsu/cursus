import type { Model } from './models/index.ts';

export type FinishReason = 'stop' | 'length' | 'tool_use' | 'content_filter' | 'error' | 'unknown';

export type Usage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'image'; mimeType: string; data: string }
  | { type: 'tool_call'; id: string; name: string; arguments: Record<string, unknown> }
  | { type: 'tool_result'; toolCallId: string; content: string; isError?: boolean };

export type Message = {
  role: MessageRole;
  content: MessagePart[];
};

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type ProviderResponse = {
  content: string;
  toolCalls: ToolCall[];
  usage: Usage;
  finishReason: FinishReason;
};

export type ProviderEventType =
  | 'content_start'
  | 'content_delta'
  | 'content_stop'
  | 'tool_use_start'
  | 'tool_use_delta'
  | 'tool_use_stop'
  | 'complete'
  | 'error'
  | 'warning';

export type ProviderEvent = {
  type: ProviderEventType;
  delta?: string;
  toolCall?: ToolCall;
  response?: ProviderResponse;
  warning?: string;
  error?: string;
};

export interface Provider {
  SendMessages(ctx: AbortSignal | undefined, messages: Message[], tools: ToolDefinition[]): Promise<ProviderResponse>;
  StreamResponse(ctx: AbortSignal | undefined, messages: Message[], tools: ToolDefinition[]): AsyncIterable<ProviderEvent>;
  Model(): Model;
}
