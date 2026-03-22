import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadConfig } from '../../config.ts';
import { createAgentProvider } from '../create-agent-provider.ts';

function withEnv(key: string, value: string | undefined, fn: () => void): void {
  const previous = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  try {
    fn();
  } finally {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
}

test('loadConfig picks default model from provider priority when api key exists', () => {
  withEnv('ANTHROPIC_API_KEY', 'ant-key', () => {
    const cfg = loadConfig('/non/existent/path.toml');
    assert.equal(cfg.llm.providers.anthropic.disabled, false);
    assert.equal(cfg.llm.agents.coder.model, 'claude-sonnet-4');
    assert.equal(cfg.llm.agents.title.maxTokens, 80);
  });
});

test('loadConfig disables providers without credentials but keeps local enabled with LOCAL_ENDPOINT', () => {
  withEnv('LOCAL_ENDPOINT', 'http://localhost:1234/v1', () => {
    const cfg = loadConfig('/non/existent/path.toml');
    assert.equal(cfg.llm.providers.openai.disabled, true);
    assert.equal(cfg.llm.providers.local.disabled, false);
    assert.equal(cfg.llm.providers.local.baseURL, 'http://localhost:1234/v1');
  });
});

test('createAgentProvider resolves provider config from agent model', () => {
  withEnv('OPENAI_API_KEY', 'sk-test', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'orgai-'));
    const cfgPath = path.join(dir, 'config.toml');
    writeFileSync(
      cfgPath,
      ['[agents.coder]', 'model = "gpt-5"', '', '[providers.openai]', 'api_key = "sk-test"', ''].join('\n'),
      'utf-8',
    );
    const cfg = loadConfig(cfgPath);
    const provider = createAgentProvider(cfg, 'coder');
    assert.equal(provider.Model().provider, 'openai');
    rmSync(dir, { recursive: true, force: true });
  });
});
