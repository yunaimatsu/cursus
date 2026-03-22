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
3. `orgai.toml` (legacy fallback)

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

## Configuration docs

- Multilingual `orgai.toml` guide: `docs/orgai-toml-config-i18n.md`
