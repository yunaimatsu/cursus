#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_CONFIG_TOML } from '../orgai/default-config.ts';

const isGlobalInstall = process.env.npm_config_global === 'true' || process.env.npm_config_location === 'global';
if (!isGlobalInstall) {
  process.exit(0);
}

const configDir = path.join(os.homedir(), '.config', 'glassblock');
const configPath = path.join(configDir, 'config.toml');

if (!existsSync(configPath)) {
  mkdirSync(configDir, { recursive: true });
  writeFileSync(configPath, DEFAULT_CONFIG_TOML, 'utf-8');
  console.log(`Created global config: ${configPath}`);
}
