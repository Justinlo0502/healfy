# Block-diagram kit

Turns a short **spec** (blocks, containers, connections) into an **editable draw.io** diagram with deterministic layout,
then **lints** it. The model only extracts structure from your code; scripts do all the geometry.

```
spec.yaml  --build_diagram.py-->  system.drawio  --lint_diagram.py-->  pass/fail report
 (model)        (ELK layout)       (you edit it)      (overlaps, crossings, label fit, spec match)
```

## Setup (once per repo)

```bash
cd docs/diagrams
npm install                      # elkjs (needs Node 18+)
pip install -r requirements.txt  # PyYAML, pytest   (Python 3.10+)
python -m pytest -q              # optional: 44 tests
python build_diagram.py spec.example.yaml -o /tmp/example.drawio   # smoke test, then open it in draw.io
```

Then paste **Prompt 1** from `CURSOR_PROMPTS.md` into Cursor to fill `diagram.config.yaml`.
Environment variables: none required (optional `DRAWIO_CLI` = path to the draw.io desktop executable, only for PNG export).

## Everyday use

1. Paste **Prompt 2** from `CURSOR_PROMPTS.md`. Cursor writes `spec.yaml`, shows it to you, you approve.
2. `python docs/diagrams/build_diagram.py docs/diagrams/spec.yaml -o docs/diagrams/system.drawio`
   (lint runs automatically; add `--export png` for PNGs if draw.io desktop is installed).
3. Open `system.drawio` (draw.io desktop, web, or the VS Code draw.io extension) and polish by hand.
4. Code changed? Update the spec, rebuild. Your manual edits survive (see below).

## What a rebuild does to your hand edits

| Thing | On rebuild |
|---|---|
| position/size/style of a block or edge whose id still exists | **kept** |
| new blocks / new connections | placed next to the existing layout (ELK positions for blocks, A* router for edges) |
| block labels, connection labels | always taken from the spec |
| containers | grow if new children need room, never move |
| cells you added by hand in draw.io | kept (tracked via `system.drawio.manifest.json`; commit it) |
| blocks/connections removed from the spec | removed |
| `--relayout` | discards all geometry and lays out fresh |
| `--restyle` | re-applies the generated styles, keeps geometry |

## Files

| File | Purpose |
|---|---|
| `spec.yaml` (you create) / `spec.example.yaml` / `schema.md` | the spec, an example, the format |
| `diagram.config.yaml` | `project:` facts for the agent, plus layout/limits for the scripts |
| `build_diagram.py`, `elk_layout.js`, `route.py`, `common.py` | spec to `.drawio` |
| `lint_diagram.py` | checks; output `ERROR/WARN page= rule= cells= detail=` and `SUMMARY`, exit code 1 on errors |
| `CURSOR_PROMPTS.md`, `../../.cursor/rules/block-diagrams.mdc` | the Cursor side |
| `tests/` | pytest suite |

## Lint rules

Errors: `overlap`, `outside-container`, `edge-through-block`, `label-overflow`, `label-overlap-block`, `label-overlap-label`,
`dangling-edge`, `wrong-endpoint` (arrow attached to a container instead of the sub-block, or any other mismatch with the spec),
`wrong-parent`, `missing-block`, `missing-connection`, `missing-page`.
Warnings: `edge-crossings`, `diagonal`, `off-grid`, `extra-cell`.

## Known limitations

* **Verified here:** the 44 tests, and renders of the generated geometry with a throwaway matplotlib renderer. **Not verified here:** opening the files in draw.io itself and `--export png` (draw.io desktop was not available in my sandbox). Open the first diagram in draw.io and tell Cursor/me if edges look off.
* Label sizes are estimates (`layout.char_width`). If draw.io's font renders wider, raise `char_width` or shorten labels.
* Incremental rebuilds can collide when a container must grow into hand-placed neighbours; the linter reports it, and `--relayout` (discarding manual edits) is the escape hatch.
* Edge crossings are minimised by ELK but not eliminated (warning only). Edges that run on top of each other for a stretch are not linted.
* Aim for at most 12 blocks per page; the layout stays readable and reliable that way.
* If `--export png` fails on Linux, the CLI needs a display (the script tries `xvfb-run` and `--no-sandbox`).
