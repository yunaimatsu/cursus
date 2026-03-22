import test from 'node:test';
import assert from 'node:assert/strict';

import { NewProvider, SUPPORTED_MODELS, WithBaseURL, normalizeFinishReason } from '../index.ts';

test('provider factory routes to anthropic implementation', () => {
  const provider = NewProvider('anthropic');
  assert.equal(provider.Model().provider, 'anthropic');
});

test('provider factory switches baseURL for openai-compatible providers', () => {
  const groq = NewProvider('groq');
  const local = NewProvider('local', WithBaseURL('http://localhost:9999/v1'));

  assert.equal(groq.Model().provider, 'groq');
  assert.equal(local.Model().provider, 'local');
  assert.equal((groq as any).options.baseURL, 'https://api.groq.com/openai/v1');
  assert.equal((local as any).options.baseURL, 'http://localhost:9999/v1');
  assert.ok(SUPPORTED_MODELS['groq-llama-4']);
});

test('finish reason normalization maps known values', () => {
  assert.equal(normalizeFinishReason('tool_calls'), 'tool_use');
  assert.equal(normalizeFinishReason('max_tokens'), 'length');
  assert.equal(normalizeFinishReason('something-else'), 'unknown');
});
