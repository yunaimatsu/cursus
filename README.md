# cursus

## orgai Meeting Protocol CLI (MVP+)

This repository includes a local `orgai` CLI that implements a deterministic meeting protocol state machine.

### Run

```bash
python -m orgai.main
```

Dry run without git side effects:

```bash
python -m orgai.main --no-git
```

### Core commands

- `/start <topic>`: starts a meeting, creates a meeting branch (unless `--no-git`), enters `RUNNING`.
- `/end`: closes and finalizes minutes to `docs/minutes/YYYY-MM-DD-topic-orgai.md`.
- `/focus <text>`: updates current focus.
- `/park <text>`: adds to parking lot.
- `/status`: prints meeting state.
- `/decide <text>`, `/task <text>`, `/note <text>`: structured minute updates.

### State machine

`IDLE -> RUNNING -> CLOSING -> DONE`

Session state is saved to `.orgai_session.json`.
