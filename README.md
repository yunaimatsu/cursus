# cursus

## mtg: Meeting Command System

This repository provides a transactional meeting OS CLI with strict event sourcing semantics.

## Run

```bash
./mtg session up
# => topic: <your topic>
# (inline topic argument is not supported)
```

## Expose `mtg` on PATH

```bash
chmod +x ./mtg
mkdir -p ~/.local/bin
ln -sf "$(pwd)/mtg" ~/.local/bin/mtg
export PATH="$HOME/.local/bin:$PATH"
```

After this, you can run:

```bash
mtg session up
```

## Layers

- `session`: lifecycle commands (`ls`, `up`, `read`, `down`)
- `event`: append-only event log (`write`, `read`)
- `doc`: curated knowledge docs (`write`, `read`)
- `exec`: side-effect log (`write`, `read`)

## Key guarantees

- Sessions are atomic and non-resumable.
- Events are immutable append-only records.
- `session down` commits durable outputs (minutes + extracted docs/tasks).
- `session up` always reconstructs context and prints visible retrieval logs.
