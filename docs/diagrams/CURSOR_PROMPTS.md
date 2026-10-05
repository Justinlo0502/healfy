# Cursor prompts for the block-diagram kit

Paste prompt 1 once per repo (fills the config). Paste prompt 2 whenever you want a diagram.
Both assume `.cursor/rules/block-diagrams.mdc` is in the repo.

---

## Prompt 1: fill in the config (once)

```
Fill in the `project:` section of docs/diagrams/diagram.config.yaml for this repository.
Do not touch the other sections of that file.

1. Look at the repo layout (directory tree, README, build files). Do not read every source file.
2. Decide and fill in: name, description, top_level (top module/entry point if one exists),
   source_roots, include_globs, exclude_globs, block_definition (what counts as one block in
   this codebase), connection_definition (what counts as a connection), interface_naming
   (the buses/interfaces/protocols used) and notes.
3. Keep every value short and factual. If you are unsure about something, write
   "UNSURE: <what you need from me>" in that field instead of guessing.
4. Show me the finished `project:` section and list the UNSURE items. Do not generate any
   diagram yet.
```

---

## Prompt 2: generate a diagram (any time)

```
Using the block-diagrams rule: create a block diagram for <SUBSYSTEM OR "the whole system">.

1. Read the `project:` section of docs/diagrams/diagram.config.yaml, then the relevant code.
2. Update docs/diagrams/spec.yaml: page 1 at subsystem level, one extra page per subsystem
   that needs internals. Max 12 blocks per page, every connection labelled with its real
   interface name, source_file on every block.
3. Stop and show me the spec, plus any questions about things the code does not make clear.
   Build only after I approve.
```

After you approve: `go ahead: build, lint, fix (max 3 iterations), and tell me what is left.`

Rebuild after code changes: `Update spec.yaml for the changes in <files/commit>, keep ids stable, then rebuild.`
