# cursus

## cs: Compact Session Command System

This repository provides a transactional meeting OS CLI with strict event sourcing semantics.

## Run

```bash
./cs ss up
# => topic: <your topic>
# (inline topic argument is not supported)
```

## Expose `cs` on PATH

```bash
chmod +x ./cs
mkdir -p ~/.local/bin
ln -sf "$(pwd)/cs" ~/.local/bin/cs
export PATH="$HOME/.local/bin:$PATH"
```

### PATH をシェルに永続化する

ターミナルを開き直しても `cs` を使えるように、使っているシェルの設定ファイルにも追記します。

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
cs ss up
```

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
