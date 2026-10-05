---
name: block-diagram
description: Generate or update editable draw.io block diagrams from this codebase using docs/diagrams (spec.yaml, build and lint scripts). Use when asked for a block diagram, architecture diagram, or to refresh diagrams after code changes.
allowed-tools: Bash(python3 docs/diagrams/*) Bash(python docs/diagrams/*)
---

# Block diagram workflow

Never hand-write draw.io XML or coordinates. Layout is done by `docs/diagrams/build_diagram.py`.
Spec format: `docs/diagrams/schema.md`. Project facts: the `project:` section of `docs/diagrams/diagram.config.yaml`.

## Step 0: config (first run only)

If the `project:` section of `docs/diagrams/diagram.config.yaml` still contains `<...>` placeholders, fill it in first
(name, description, top_level, source_roots, include_globs, exclude_globs, block_definition, connection_definition,
interface_naming, notes). Look at the repo layout and README only, keep values short, write `UNSURE: <question>` for
anything unclear. Show me the result and wait for my OK before continuing.

## Steps

1. **Update `docs/diagrams/spec.yaml` from the code** for the subsystem I named (or the whole system if I did not name one).
   Every block needs a stable `id`, `label`, `parent` (if nested) and `source_file`. Every connection needs a `label`
   with the real interface name from the code (AXI4, APB, valid/ready...), not "data".
   **Stop and show me the spec, plus questions about anything the code does not make clear, before building** (skip the
   pause only if I said to go ahead).
2. **Build (lint runs automatically against the spec):**
   `python3 docs/diagrams/build_diagram.py docs/diagrams/spec.yaml -o docs/diagrams/system.drawio`
   Add `--export png` only if I ask for images and the draw.io CLI is installed.
3. **Fix lint output, max 3 iterations**, then report what remains. Lines look like
   `ERROR page=<p> rule=<rule> cells=<ids> detail=<text>`. Fix the spec (never the XML) and rebuild.

   | rule | usual fix |
   |---|---|
   | `label-overflow` | shorten the block label or add `\n` |
   | `label-overlap-block`, `label-overlap-label` | shorten the connection label, or raise `layout.layer_spacing` in the config |
   | `wrong-endpoint`, `wrong-parent`, `missing-block`, `missing-connection` | spec and diagram disagree: fix the spec, rebuild |
   | `edge-through-block`, `overlap`, `outside-container` | after an incremental rebuild this means new items collided with hand-placed ones. **Never run `--relayout` without asking me** (it discards my manual edits); tell me which cells collide |
   | `edge-crossings` (warning) | acceptable; reduce by grouping blocks into containers or splitting the page |
   | `off-grid`, `diagonal`, `extra-cell` (warnings) | usually from my hand edits; ignore |

4. If a PNG was exported, look at it and report anything the linter cannot catch (cramped areas, confusing grouping).

## Spec rules

* Max 12 blocks per page. Page 1 = subsystem level; one extra page per subsystem for its internals.
* Containers are expressed with `parent`. Connections target the most specific block; connect to a container only when
  the interface belongs to the whole subsystem.
* Block labels max 24 chars, connection labels max 20 chars.
* Never rename an id (it loses my manual positioning for that block).
* Do not invent blocks or connections that are not in the code. List unclear things as questions.

## Editing rules

* Rebuilding keeps the geometry and style of every existing cell id, so my hand edits survive. Only new blocks and edges
  are placed. Label text always comes from the spec.
* `--relayout` and `--restyle` only when I ask.
* Commit `system.drawio` together with `system.drawio.manifest.json`.