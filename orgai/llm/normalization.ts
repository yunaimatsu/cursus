import type { FinishReason, Usage } from './types.ts';

export function normalizeFinishReason(reason: string | null | undefined): FinishReason {
  const value = (reason ?? '').toLowerCase();
  if (value === 'stop' || value === 'end_turn') return 'stop';
  if (value === 'length' || value === 'max_tokens') return 'length';
  if (value === 'tool_calls' || value === 'tool_use' || value === 'function_call') return 'tool_use';
  if (value === 'content_filter') return 'content_filter';
  if (value === 'error') return 'error';
  return 'unknown';
}

export function normalizeUsage(raw: Partial<{ prompt_tokens: number; completion_tokens: number; total_tokens: number }>): Usage {
  const inputTokens = raw.prompt_tokens ?? 0;
  const outputTokens = raw.completion_tokens ?? 0;
  const totalTokens = raw.total_tokens ?? inputTokens + outputTokens;
  return { inputTokens, outputTokens, totalTokens };
}
