# glassblock-cli

## gb: Compact Session Command System

This repository provides a transactional meeting OS CLI with strict event sourcing semantics.

## Run

```bash
./gb init
# => creates .glassblock/config.toml

./gb ss up
# => topic: <your topic>
# (inline topic argument is not supported)
```

## Expose `gb` on PATH

```bash
chmod +x ./gb
mkdir -p ~/.local/bin
ln -sf "$(pwd)/gb" ~/.local/bin/gb
export PATH="$HOME/.local/bin:$PATH"
```

### PATH をシェルに永続化する

ターミナルを開き直しても `gb` を使えるように、使っているシェルの設定ファイルにも追記します。

```bash
# bash の場合
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# zsh の場合
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

After this, you can run:

```bash
gb ss up
```

## Global install config

If you install with npm globally (`npm install -g ...`), postinstall creates:

- `~/.config/glassblock/config.toml`

`gb` looks up config in this order:

1. `.glassblock/config.toml` (repo local)
2. `~/.config/glassblock/config.toml` (global)

## Layers

- `ss` (`session`): lifecycle commands (`ls`, `up`, `rd`/`read`, `dn`/`down`)
- `ev` (`event`): append-only event log (`wr`/`write`, `rd`/`read`)
- `dc` (`doc`): curated knowledge docs (`wr`/`write`, `rd`/`read`)
- `ex` (`exec`): side-effect log (`wr`/`write`, `rd`/`read`)

## Key guarantees

- Sessions are atomic and non-resumable.
- Events are immutable append-only records.
- `ss dn` commits durable outputs (minutes + extracted docs/tasks).
- `ss up` always reconstructs context and prints visible retrieval logs.


## Runtime

- Node.js 22+ (uses `--experimental-strip-types` to run TypeScript directly).

## LLM Provider Layer

The repository now includes a provider-agnostic LLM layer at `orgai/llm`.

- First-class providers: OpenAI, Anthropic, Gemini
- OpenAI-compatible providers: Groq, OpenRouter, xAI, Local endpoint
- Extendable slots: Azure OpenAI and Vertex AI model catalogs

### Provider config example (`.glassblock/config.toml`)

```toml
[providers.openai]
api_key = "sk-..."

[providers.anthropic]
api_key = "sk-ant-..."

[providers.gemini]
api_key = "AIza..."

[providers.local]
base_url = "http://localhost:11434/v1"
api_key = "dummy"

[agents.coder]
model = "gpt-5"
reasoning_effort = "high"
```

Environment variables are also supported (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, etc.), and `LOCAL_ENDPOINT` automatically overrides the Local provider URL.

### Internal flow (API key -> model -> provider)

1. `loadConfig()` merges TOML + env and builds `llm.providers` and `llm.agents`.
2. `setProviderDefaults()` injects `*_API_KEY` / cloud endpoints.
3. `setDefaultModelForAgents()` selects default agent model by provider priority.
4. `validateProviders()` disables providers without credentials (with cloud exceptions).
5. `createAgentProvider()` resolves `agent -> model -> provider config` and calls `NewProvider(...)`.
6. Provider adapters convert messages/tools and normalize finish reasons + usage.

## Configuration docs

- Multilingual `orgai.toml` guide: `docs/orgai-toml-config-i18n.md`

## Minimal Codex-style board (`gb board`)

A keyboard-first board is available in the terminal:

```bash
gb board
```

### Layout

- Top: `prompt board` (draft task prompt)
- Bottom: `task board` (queued/running tasks)
- Optional bottom panel: `task detail panel`

### Keys

- `Enter`: queue prompt as a new task (and create `task/<timestamp>-<slug>` branch)
- `n`: newline in prompt editor
- `j` / `k`: move focus in task board
- `Enter` (on task board with empty prompt): toggle detail panel
- `i`: enter instruction mode in detail panel
- `Enter` (instruction mode): append instruction to focused task
- `s`: cycle status (`working -> waiting you -> PR made -> merged`)
- `q` or `Ctrl+C`: quit

`gb board` persists tasks to `.mtg/board/tasks.json`.
